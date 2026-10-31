//! PROPOSED → GATED → APPROVED → SUBMITTED → FILLED, with the BLOCKED /
//! REJECTED / UNKNOWN→RECONCILED branches from spec §3.2. Illegal
//! transitions are a compile-time-adjacent *runtime* error (not a panic) —
//! the journal records the attempt either way so nothing is silently lost.

use crate::types::OrderStatus;
use thiserror::Error;

#[derive(Debug, Error)]
#[error("illegal transition: {from:?} -> {to:?}")]
pub struct IllegalTransition {
    pub from: OrderStatus,
    pub to: OrderStatus,
}

pub fn allowed(from: &OrderStatus, to: &OrderStatus) -> bool {
    use OrderStatus::*;
    matches!(
        (from, to),
        (Proposed, Gated)
            | (Proposed, Blocked)
            | (Gated, Approved)
            | (Gated, Blocked)
            | (Approved, Submitted)
            | (Submitted, Filled)
            | (Submitted, Partial)
            | (Submitted, Rejected)
            | (Submitted, Unknown)
            | (Partial, Filled)
            | (Partial, Cancelled)
            | (Unknown, Reconciled)
    )
}

pub fn transition(from: OrderStatus, to: OrderStatus) -> Result<OrderStatus, IllegalTransition> {
    if allowed(&from, &to) {
        Ok(to)
    } else {
        Err(IllegalTransition { from, to })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use OrderStatus::*;

    #[test]
    fn happy_path_is_allowed() {
        assert!(transition(Proposed, Gated).is_ok());
        assert!(transition(Gated, Approved).is_ok());
        assert!(transition(Approved, Submitted).is_ok());
        assert!(transition(Submitted, Filled).is_ok());
    }

    #[test]
    fn skipping_the_risk_gate_is_rejected() {
        // Nothing may go straight from Proposed to Submitted — this is the
        // structural guarantee that every order passes risk_engine::gate().
        assert!(transition(Proposed, Submitted).is_err());
    }

    #[test]
    fn unknown_must_be_reconciled_not_assumed_filled() {
        assert!(transition(Unknown, Filled).is_err());
        assert!(transition(Unknown, Reconciled).is_ok());
    }
}
