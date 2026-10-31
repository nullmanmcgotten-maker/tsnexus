//! Per-adapter channels so one adapter's crash or rate-limit backoff never
//! blocks another. For the 3-week demo this runs in-process over tokio
//! mpsc/broadcast; swapping in Redis later means re-implementing this same
//! `Bus` trait against redis-rs without touching callers.

use crate::types::{Market, Quote};
use std::collections::HashMap;
use tokio::sync::{broadcast, mpsc};

pub struct Bus {
    quote_tx: HashMap<Market, mpsc::Sender<Quote>>,
    health_tx: broadcast::Sender<(Market, bool)>,
}

impl Bus {
    pub fn new(buffer: usize) -> (Self, HashMap<Market, mpsc::Receiver<Quote>>) {
        let markets = [Market::PerpBinance, Market::Polymarket, Market::SolanaMemecoin];
        let mut quote_tx = HashMap::new();
        let mut quote_rx = HashMap::new();
        for m in markets {
            let (tx, rx) = mpsc::channel(buffer);
            quote_tx.insert(m, tx);
            quote_rx.insert(m, rx);
        }
        let (health_tx, _) = broadcast::channel(32);
        (Self { quote_tx, health_tx }, quote_rx)
    }

    pub async fn publish_quote(&self, q: Quote) -> Result<(), mpsc::error::SendError<Quote>> {
        if let Some(tx) = self.quote_tx.get(&q.adapter) {
            tx.send(q).await
        } else {
            Ok(())
        }
    }

    pub fn subscribe_health(&self) -> broadcast::Receiver<(Market, bool)> {
        self.health_tx.subscribe()
    }

    pub fn report_health(&self, market: Market, healthy: bool) {
        let _ = self.health_tx.send((market, healthy));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Side;

    #[tokio::test]
    async fn quote_for_one_market_does_not_reach_another() {
        let (bus, mut rx) = Bus::new(8);
        let q = Quote {
            adapter: Market::Polymarket,
            symbol: "EVT-1".into(),
            side: Side::Buy,
            price: 0.5,
            size: 10.0,
            notional_usd: 5.0,
            slippage_bps: 0.0,
            metadata: Default::default(),
        };
        bus.publish_quote(q).await.unwrap();

        assert!(rx.get_mut(&Market::Polymarket).unwrap().recv().await.is_some());
        assert!(rx
            .get_mut(&Market::PerpBinance)
            .unwrap()
            .try_recv()
            .is_err());
    }
}
