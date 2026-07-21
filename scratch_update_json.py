import json

workflows = {
    "ORDER_LIFECYCLE": {
        "description": "Main lifecycle for OTC orders",
        "states": [
            {"id": "DRAFT", "display_name": "Draft"},
            {"id": "SUBMITTED", "display_name": "Submitted"},
            {"id": "PREPARING", "display_name": "Preparing"},
            {"id": "WAITING_CUSTOMER_CONFIRMATION", "display_name": "Waiting Customer Confirmation"},
            {"id": "READY_FOR_PICKUP", "display_name": "Ready For Pickup"},
            {"id": "NOT_COLLECTED", "display_name": "Not Collected"},
            {"id": "COMPLETED", "display_name": "Completed"},
            {"id": "CANCELLED", "display_name": "Cancelled"},
            {"id": "CLOSED", "display_name": "Closed"}
        ],
        "transitions": [
            {
                "id": "OL-001",
                "current_state": "DRAFT",
                "event": "submit_order",
                "label": "Submit Order",
                "allowed_roles": ["CUSTOMER"],
                "next_state": "SUBMITTED"
            },
            {
                "id": "OL-002",
                "current_state": "DRAFT",
                "event": "discard_draft",
                "label": "Discard Draft",
                "danger": True,
                "allowed_roles": ["CUSTOMER"],
                "next_state": "CANCELLED"
            },
            {
                "id": "OL-003",
                "current_state": "SUBMITTED",
                "event": "start_preparing",
                "label": "Start Preparing",
                "allowed_roles": ["PHARMACY_STAFF", "PHARMACIST"],
                "next_state": "PREPARING"
            },
            {
                "id": "OL-004",
                "current_state": "PREPARING",
                "event": "report_change",
                "label": "Ask Customer About Replacement",
                "allowed_roles": ["PHARMACY_STAFF", "PHARMACIST"],
                "next_state": "WAITING_CUSTOMER_CONFIRMATION"
            },
            {
                "id": "OL-005",
                "current_state": "WAITING_CUSTOMER_CONFIRMATION",
                "event": "accept_change",
                "label": "Accept Change",
                "allowed_roles": ["CUSTOMER"],
                "next_state": "PREPARING"
            },
            {
                "id": "OL-006",
                "current_state": "PREPARING",
                "event": "mark_ready",
                "label": "Mark Ready For Pickup",
                "allowed_roles": ["PHARMACY_STAFF", "PHARMACIST"],
                "next_state": "READY_FOR_PICKUP",
                "actions": [
                    {"type": "DISPATCH_EVENT", "event": "generate_otp"}
                ]
            },
            {
                "id": "OL-007",
                "current_state": "READY_FOR_PICKUP",
                "event": "pickup_deadline_expired",
                "label": "Pickup Timeout",
                "allowed_roles": ["SYSTEM"],
                "next_state": "NOT_COLLECTED"
            },
            {
                "id": "OL-008",
                "current_state": "NOT_COLLECTED",
                "event": "close_order",
                "label": "Close Abandoned Order",
                "allowed_roles": ["PHARMACY_STAFF", "PHARMACIST", "SYSTEM"],
                "next_state": "CLOSED"
            },
            {
                "id": "OL-009",
                "current_state": "READY_FOR_PICKUP",
                "event": "handover_completed",
                "label": "Handover Completed",
                "allowed_roles": ["SYSTEM"],
                "next_state": "COMPLETED"
            },
            {
                "id": "OL-010",
                "current_state": "SUBMITTED",
                "event": "cancel_order",
                "label": "Cancel Order",
                "danger": True,
                "allowed_roles": ["CUSTOMER"],
                "next_state": "CANCELLED"
            },
            {
                "id": "OL-011",
                "current_state": "PREPARING",
                "event": "cancel_order",
                "label": "Cancel Order",
                "danger": True,
                "allowed_roles": ["CUSTOMER"],
                "next_state": "CANCELLED"
            },
            {
                "id": "OL-012",
                "current_state": "WAITING_CUSTOMER_CONFIRMATION",
                "event": "cancel_order",
                "label": "Cancel Order",
                "danger": True,
                "allowed_roles": ["CUSTOMER"],
                "next_state": "CANCELLED"
            },
            {
                "id": "OL-013",
                "current_state": "WAITING_CUSTOMER_CONFIRMATION",
                "event": "reject_change",
                "label": "Reject Change",
                "danger": True,
                "allowed_roles": ["CUSTOMER"],
                "next_state": "CANCELLED"
            },
            {
                "id": "OL-014",
                "current_state": "READY_FOR_PICKUP",
                "event": "cancel_order",
                "label": "Cancel Order",
                "danger": True,
                "allowed_roles": ["CUSTOMER"],
                "next_state": "CANCELLED"
            }
        ]
    },
    "PAYMENT": {
        "description": "Payment tracking lifecycle",
        "states": [
            {"id": "UNPAID", "display_name": "Unpaid"},
            {"id": "PAID", "display_name": "Paid"},
            {"id": "REFUNDED", "display_name": "Refunded"}
        ],
        "transitions": [
            {
                "id": "PAY-001",
                "current_state": "UNPAID",
                "event": "make_payment",
                "label": "Pay Online",
                "allowed_roles": ["CUSTOMER"],
                "conditions": [
                    {
                        "path": "states.ORDER_LIFECYCLE",
                        "operator": "in",
                        "value": ["SUBMITTED", "PREPARING", "WAITING_CUSTOMER_CONFIRMATION", "READY_FOR_PICKUP"]
                    }
                ],
                "next_state": "PAID"
            },
            {
                "id": "PAY-002",
                "current_state": "UNPAID",
                "event": "pay_at_counter",
                "label": "Record Cash Payment",
                "allowed_roles": ["PHARMACY_STAFF", "PHARMACIST"],
                "conditions": [
                    {
                        "path": "states.ORDER_LIFECYCLE",
                        "operator": "equals",
                        "value": "READY_FOR_PICKUP"
                    }
                ],
                "next_state": "PAID"
            },
            {
                "id": "PAY-003",
                "current_state": "PAID",
                "event": "refund_payment",
                "label": "Refund Payment",
                "allowed_roles": ["SYSTEM"],
                "next_state": "REFUNDED"
            }
        ]
    },
    "PICKUP_VERIFICATION": {
        "description": "OTP and Handover validation",
        "states": [
            {"id": "NOT_READY", "display_name": "Not Ready"},
            {"id": "OTP_AVAILABLE", "display_name": "OTP Available"},
            {"id": "OTP_VERIFIED", "display_name": "OTP Verified"},
            {"id": "HANDED_OVER", "display_name": "Handed Over"}
        ],
        "transitions": [
            {
                "id": "PK-001",
                "current_state": "NOT_READY",
                "event": "generate_otp",
                "label": "Generate OTP",
                "allowed_roles": ["SYSTEM"],
                "conditions": [
                    {
                        "path": "states.ORDER_LIFECYCLE",
                        "operator": "equals",
                        "value": "READY_FOR_PICKUP"
                    }
                ],
                "next_state": "OTP_AVAILABLE"
            },
            {
                "id": "PK-002",
                "current_state": "OTP_AVAILABLE",
                "event": "verify_otp",
                "label": "Verify OTP",
                "allowed_roles": ["PHARMACY_STAFF", "PHARMACIST"],
                "next_state": "OTP_VERIFIED"
            },
            {
                "id": "PK-003",
                "current_state": "OTP_VERIFIED",
                "event": "complete_handover",
                "label": "Complete Handover",
                "allowed_roles": ["PHARMACY_STAFF", "PHARMACIST"],
                "conditions": [
                    {
                        "path": "states.PAYMENT",
                        "operator": "equals",
                        "value": "PAID"
                    }
                ],
                "validation_errors": {
                    "states.PAYMENT": {
                        "code": "PAYMENT_REQUIRED",
                        "severity": "BLOCKING",
                        "message": "Payment must be PAID before handover."
                    }
                },
                "next_state": "HANDED_OVER",
                "actions": [
                    {"type": "DISPATCH_EVENT", "event": "handover_completed"}
                ]
            }
        ]
    },
    "ISSUE_MANAGEMENT": {
        "description": "Post-completion issue management and refunds",
        "states": [
            {"id": "NO_ISSUE", "display_name": "No Issue"},
            {"id": "ISSUE_REPORTED", "display_name": "Issue Reported"},
            {"id": "UNDER_REVIEW", "display_name": "Under Review"},
            {"id": "RESOLVED", "display_name": "Resolved"},
            {"id": "REJECTED", "display_name": "Rejected"}
        ],
        "transitions": [
            {
                "id": "ISS-001",
                "current_state": "NO_ISSUE",
                "event": "report_issue",
                "label": "Report Problem",
                "danger": True,
                "allowed_roles": ["CUSTOMER"],
                "conditions": [
                    {
                        "path": "states.ORDER_LIFECYCLE",
                        "operator": "equals",
                        "value": "COMPLETED"
                    }
                ],
                "next_state": "ISSUE_REPORTED"
            },
            {
                "id": "ISS-002",
                "current_state": "ISSUE_REPORTED",
                "event": "review_issue",
                "label": "Review Issue",
                "allowed_roles": ["PHARMACY_STAFF", "PHARMACIST", "ADMIN"],
                "next_state": "UNDER_REVIEW"
            },
            {
                "id": "ISS-003",
                "current_state": "UNDER_REVIEW",
                "event": "approve_refund",
                "label": "Approve Refund",
                "allowed_roles": ["PHARMACY_STAFF", "PHARMACIST", "ADMIN"],
                "next_state": "RESOLVED",
                "actions": [
                    {"type": "DISPATCH_EVENT", "event": "refund_payment"}
                ]
            },
            {
                "id": "ISS-004",
                "current_state": "UNDER_REVIEW",
                "event": "reject_claim",
                "label": "Reject Claim",
                "danger": True,
                "allowed_roles": ["PHARMACY_STAFF", "PHARMACIST", "ADMIN"],
                "next_state": "REJECTED"
            }
        ]
    }
}

config = {
    "version": "1.2",
    "workflows": workflows
}

with open("config/transitions.json", "w") as f:
    json.dump(config, f, indent=2)

print("Updated config/transitions.json")
