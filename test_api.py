import requests
import json

BASE_URL = "http://localhost:8000"

# 1. Load scenario
res = requests.post(f"{BASE_URL}/orders/scenario", json={"scenario": "OTC_DRAFT"})
order = res.json()["data"]
order_id = order["order_id"]
print("Initial States:", order["states"])

# 2. Submit order
res = requests.post(f"{BASE_URL}/orders/{order_id}/transition", json={
    "event": "submit_order",
    "user_role": "CUSTOMER",
    "context_updates": order["context"]
})
print("Submit Order Response:", res.json())

# Fetch order
res = requests.get(f"{BASE_URL}/orders/{order_id}")
order = res.json()["data"]
print("After Submit States:", order["states"])

# 3. Pharmacy confirm
res = requests.post(f"{BASE_URL}/orders/{order_id}/transition", json={
    "event": "pharmacy_confirm",
    "user_role": "PHARMACY_STAFF",
    "context_updates": order["context"]
})
# Fetch order
res = requests.get(f"{BASE_URL}/orders/{order_id}")
order = res.json()["data"]
print("After Pharmacy Confirm States:", order["states"])

# 4. Customer confirm
res = requests.post(f"{BASE_URL}/orders/{order_id}/transition", json={
    "event": "customer_confirm",
    "user_role": "CUSTOMER",
    "context_updates": order["context"]
})
# Fetch order
res = requests.get(f"{BASE_URL}/orders/{order_id}")
order = res.json()["data"]
print("After Customer Confirm States:", order["states"])
print("Audit Logs:")
res = requests.get(f"{BASE_URL}/audit-logs")
for log in res.json()["data"][-5:]:
    print(f"Transition: {log['event']} from {log['from_state']} to {log['to_state']}, actions: {log['action_results']}")
