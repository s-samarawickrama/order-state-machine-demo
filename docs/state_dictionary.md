# MediPick Unified Order State Machine Architecture

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

                 CLOSED
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
- **`DRAFT`**: Cart status. Customer builds the cart. No order exists, pharmacy cannot see it, and no payment/cancellation is allowed.
- **`SUBMITTED`**: Customer placed order. Order ID exists. Starts validation flow.
- **`WAITING_PHARMACY_CONFIRMATION`**: Pharmacy checks stock and details replacement/delay information in context metadata. Only `PHARMACY_STAFF` can confirm availability. `PHARMACY_STAFF` cannot approve prescriptions.
- **`WAITING_CUSTOMER_CONFIRMATION`**: Customer accepts or rejects changes/proposals.
- **`PREPARING`**: Pharmacy staff is packing/preparing. Late cancellation rules apply past this point.
- **`READY_FOR_PICKUP`**: Medicine is verified at the counter. OTP becomes available.
- **`NOT_COLLECTED`**: Customer failed to collect within 48h.
- **`COMPLETED`**: Terminal successful order lifecycle state after successful handover. Handover boundary where cancellations are disabled and issue reporting begins.
- **`CANCELLED`**: Order cancelled.
- **`CLOSED`**: Terminal administrative state following a no-show.

### 2. PRESCRIPTION_VALIDATION FSM
Active only for `PRESCRIPTION` or `MIXED` orders. Note that prescription validation is a **separate parallel workflow** and does NOT run inside `ORDER_LIFECYCLE`.
- **`NOT_REQUIRED`**: OTC-only order.
- **`UPLOADED`**: Customer uploaded prescription image.
- **`VALIDATING`**: Automated AI scoring.
- **`AWAITING_PRESCRIPTION_UPLOAD`**: Customer needs to upload a new prescription image.
- **`PHARMACIST_REVIEW`**: Pharmacist manual verification.
- **`APPROVED`**: Pharmacist approved prescription.
- **`REJECTED`**: Prescription rejected.

**Order Type Validation Flow Rules**:
- **OTC**: `PRESCRIPTION_VALIDATION = NOT_REQUIRED`. Bypasses validation and progresses to availability check in `ORDER_LIFECYCLE` WAITING_PHARMACY_CONFIRMATION.
- **Prescription**: Starts in `UPLOADED`, routing through `VALIDATING` and `PHARMACIST_REVIEW` to `APPROVED`.
- **Mixed**: Mixed orders require prescription validation only for prescription-required items. OTC items do not participate in prescription validation and are handled through normal availability checking. Prescription validation starts in `UPLOADED`, moving to `VALIDATING` and `PHARMACIST_REVIEW` in parallel. Meanwhile, the pharmacy can check stock availability (does not wait for prescription approval before checking stock). Note that FSM states are not item-level. Item-level details (e.g. pending/approved count) are tracked in context metadata:
  ```json
  {
    "order_type": "MIXED",
    "prescription_required": true,
    "items": [
      {
        "name": "Panadol",
        "requires_prescription": false,
        "validation_status": "NOT_REQUIRED"
      },
      {
        "name": "Amoxicillin",
        "requires_prescription": true,
        "validation_status": "APPROVED"
      }
    ]
  }
  ```

**Confirmation Gate**:
The order can enter `PREPARING` only when:
1. Pharmacy availability is confirmed.
2. Customer confirms the final proposal.
3. If prescription-required items exist: all required prescription items must be approved according to context metadata, and `PRESCRIPTION_VALIDATION = APPROVED` represents the approved validation milestone. For OTC-only orders, `PRESCRIPTION_VALIDATION = NOT_REQUIRED` is accepted.

**Prescription Validation Permissions**:
- **`PHARMACIST` ONLY**: Can execute `approve_prescription` and `reject_prescription`.
- **Forbidden**: `CUSTOMER`, `PHARMACY_STAFF`, `ADMIN`, `SYSTEM` cannot change prescription validation state.

**Prescription Rejection Rule**:
If the pharmacist rejects required prescription items:
- `PRESCRIPTION_VALIDATION` transitions to `REJECTED`.
- The order cannot enter `PREPARING`.
- The Policy Engine decides whether to request a new prescription (keeping FSM in `REJECTED` and setting context metadata flag `requires_new_upload`), cancel, or request support contact.

### 3. PAYMENT FSM
- **`NOT_REQUIRED`**: No payment needed.
- **`UNPAID`**: Default unpaid status.
- **`PAYMENT_PENDING`**: Processing.
- **`PAID`**: Payment successful.
- **`FAILED`**: Payment failed.
- **`REFUNDED`**: Refund issued after policy authorization.

**Payment Gate Rule**:
Payment is strictly blocked until the order reaches `PREPARING` after customer confirmation.
- **Allowed states**: `PREPARING`, `READY_FOR_PICKUP`.
- **Not allowed**: `DRAFT`, `SUBMITTED`, `WAITING_PHARMACY_CONFIRMATION`, `WAITING_CUSTOMER_CONFIRMATION`, `COMPLETED`, `CANCELLED`, `CLOSED`.

### 4. PICKUP_VERIFICATION FSM
- **`WAITING_FOR_PICKUP`**: Awaiting customer arrival.
- **`OTP_AVAILABLE`**: OTP code is generated for verification.
- **`OTP_VERIFIED`**: Customer identity confirmed.
- **`HANDED_OVER`**: Handover verification complete.

**Final Handover Requirement**:
Requires `OTP_VERIFIED` AND `PAYMENT = PAID` to transition to `HANDED_OVER`.
`PICKUP_VERIFICATION = HANDED_OVER` represents the physical handover event. After successful handover, `ORDER_LIFECYCLE` transitions to `COMPLETED`. `COMPLETED` represents the administrative completion of the order.

**Handover Rule**:
An order cannot enter `OTP_AVAILABLE` or `HANDED_OVER` unless payment requirements are satisfied.
- For paid orders: `PAYMENT` must be `PAID` before handover.
- For unpaid pickup orders: the pharmacy may allow collection only if the payment method is `NOT_REQUIRED`.

### 5. ISSUE_MANAGEMENT FSM
Active only after `COMPLETED`.
- **`NO_ISSUE`**: Default state.
- **`ISSUE_REPORTED`**: Customer complaint filed within 48h after collection.
- **`UNDER_REVIEW`**: Claim investigation in progress.
- **`RESOLVED`**: Refund/replacement authorized.
- **`REJECTED`**: Claim rejected.

---

## Cancellation Rules
- **Before PREPARING**: Customer can cancel normally. If paid, refund is automatically allowed.
- **During PREPARING or READY_FOR_PICKUP**: Cancellation is a late cancellation. Policy Engine evaluates refund eligibility, penalty count, and special item restrictions.
- **After COMPLETED**: Normal cancellation is disabled. Only `ISSUE_MANAGEMENT` workflow is available.

---

## Role Enforcement
- **`CUSTOMER`**: Can submit, confirm/cancel, pay online, report issue, upload/reupload prescription.
- **`PHARMACY_STAFF`**: Can check availability, prepare order, verify OTP, complete handover. **Cannot approve prescriptions.**
- **`PHARMACIST`**: Exclusive authority to review and approve/reject prescriptions or resolve post-collection issues.
- **`ADMIN`**: Overrides policies and manages disputes.
- **`SYSTEM`**: Automatic timers (48h expiry) and event dispatches.
