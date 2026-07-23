# MediPick Unified Order State Machine Architecture (2-FSM Version)

## Purpose
MediPick has **one order system**. An order can contain:
1. **OTC medicines only**
2. **Prescription medicines only**
3. **Mixed medicines (OTC + Prescription)**

The difference between these scenarios is only during the **validation phase**. After validation is complete, all orders follow the same unified fulfillment lifecycle.

```
                 CUSTOMER CART
                       |
                       |
                SUBMIT ORDER
                       |
                       v
                 SUBMITTED
                       |
       --------------------------------
       |              |               |
       |              |               |
      OTC      PRESCRIPTION        MIXED
       |              |               |
       --------------------------------
                       |
                       |
       Validation Completed
                       |
                       v

        WAITING_PHARMACY_CONFIRMATION

                       |
                       v

        WAITING_CUSTOMER_CONFIRMATION

                       |
                       v

                 PREPARING

                       |
                       v

              READY_FOR_PICKUP

                       |
                       v

                 COMPLETED
                       |
                       v
                 ISSUE_REPORTED ➔ UNDER_REVIEW ➔ RESOLVED / REJECTED
```

---

## Core Architecture Rules

### 1. FSM Records Facts Only
State machines answer the question: **"What physically happened?"**
Examples:
- Order submitted
- Pharmacy confirmed availability
- Customer confirmed order
- Order preparing
- Order ready
- Order collected

### 2. Context Metadata Stores Details
Examples:
- Medicine availability
- Replacement suggestions
- Prescription score
- Pharmacy messages
- Refund reasons
- Late cancellation count
- No-show count
- Timestamps
- OTP generation and verification flags

### 3. Policy Engine Decides Business Outcomes
Examples:
- Should customer get refund?
- Should cancellation penalty apply?
- Should no-show count increase?
- Should replacement be allowed?

---

## FSM States & Flow Logic

### 1. ORDER_LIFECYCLE FSM
Tracks physical order progress.
- **`DRAFT`**: Cart status. Customer builds the cart. No order exists.
- **`SUBMITTED`**: Customer placed order. Starts validation/routing.
- **`PRESCRIPTION_VALIDATION`**: Pharmacist manual verification state for prescription-based orders.
- **`AWAITING_PRESCRIPTION_UPLOAD`**: Customer needs to upload a new prescription image.
- **`WAITING_PHARMACY_CONFIRMATION`**: Pharmacy checks stock and details replacement/delay information.
- **`WAITING_CUSTOMER_CONFIRMATION`**: Customer accepts or rejects changes/proposals.
- **`PREPARING`**: Pharmacy staff is packing/preparing. Late cancellation rules apply past this point.
- **`READY_FOR_PICKUP`**: Medicine is ready at counter.
- **`COMPLETED`**: Handover verification complete and order collected.
- **`CANCELLED`**: Order cancelled.
- **`CLOSED`**: Terminal administrative state following a no-show.
- **`ISSUE_REPORTED`**: Customer complaint filed within 48h after collection.
- **`UNDER_REVIEW`**: Claim investigation in progress.
- **`RESOLVED`**: Refund/replacement authorized.
- **`REJECTED`**: Claim rejected.

### 2. PAYMENT FSM
- **`UNPAID`**: Default unpaid status.
- **`PAID`**: Payment successful.
- **`REFUND_REQUESTED`**: Customer or staff initiated refund request pending pharmacist/admin approval.
- **`REFUNDED`**: Refund issued after policy authorization.

---

## Cancellation Rules
- **Before PREPARING**: Customer can cancel normally. If paid, refund is automatically allowed.
- **During PREPARING or READY_FOR_PICKUP**: Cancellation is a late cancellation. Policy Engine evaluates refund eligibility, penalty count, and special item restrictions.
- **After COMPLETED**: Normal cancellation is disabled. Only the issue resolution flow (`report_issue` -> `start_investigation` -> `resolve_issue` / `reject_claim`) is available.

---

## Role Enforcement
- **`CUSTOMER`**: Can submit, confirm/cancel, pay online, report issue, upload/reupload prescription.
- **`PHARMACY_STAFF`**: Can check availability, prepare order, verify OTP, complete handover, start issue investigation. **Cannot approve prescriptions or resolve disputes.**
- **`PHARMACIST`**: Exclusive authority to review and approve/reject prescriptions or resolve post-collection issues.
- **`ADMIN`**: Overrides policies and manages disputes.
- **`SYSTEM`**: Automatic timers (48h expiry) and event dispatches.
