#!/usr/bin/env python3
"""Seed the Nimbus Coffee demo org with sample customers and orders.

Creates ~55 Contacts (50 people, 5 of them deliberately duplicated with a
different name spelling on the same email — fuel for the identity resolution
lab) and ~200 Coffee_Order__c records in varied states.

All HTTP goes through `sf api request rest`, so the CLI signs every request
and this script never sees a credential. (The CLI redacts access tokens in
its JSON output on purpose — don't fight that, use it.)

Prereqs:
  - The Coffee_Order__c object exists (see learn/03 milestone spec).
  - You're logged into the org: sf org display -o tokenzempic-dev works.

Usage:
  python3 demo/scripts/seed_data.py           # seed
  python3 demo/scripts/seed_data.py --reset   # delete seeded data, then seed
"""

import json
import os
import random
import subprocess
import sys
import tempfile
from datetime import date, timedelta

ORG_ALIAS = "tokenzempic-dev"
API = "v67.0"
EMAIL_DOMAIN = "nimbuscoffee.example"  # marks seeded records so --reset only touches ours
random.seed(42)  # same data every run — reruns and demo takes stay comparable

FIRST = ["Maya", "Omar", "Lena", "Tariq", "Ava", "Sami", "Nora", "Zaid", "Ella", "Rami",
         "Isla", "Karim", "Dana", "Yusuf", "Mira", "Adam", "Layla", "Hadi", "Rosa", "Faris",
         "June", "Nabil", "Cleo", "Idris", "Vera", "Salim", "Iris", "Bilal", "Nina", "Ziad",
         "Ruth", "Anis", "Lila", "Musa", "Skye", "Fadi", "Gina", "Nour", "Tess", "Walid",
         "Hope", "Sari", "Enid", "Jad", "Wren", "Amin", "Lois", "Rafa", "Beth", "Kais"]
LAST = ["Reyes", "Haddad", "Kim", "Nasser", "Brooks", "Aoun", "Ford", "Sleiman", "Hayes", "Khoury"]

CATALOG = [
    ("Nimbus House Blend 1kg", 24.00),
    ("Cloudburst Espresso 500g", 19.50),
    ("Cumulus Decaf 500g", 18.00),
    ("Stratus Cold Brew Kit", 42.00),
    ("Altocumulus Sampler Box", 35.00),
]


def request(method, path, body=None):
    """Make an org request via the sf CLI, which signs it for us."""
    cmd = ["sf", "api", "request", "rest", f"/services/data/{API}/{path}",
           "-X", method, "-o", ORG_ALIAS]
    stdin = None
    if body is not None:
        cmd += ["-b", "-"]  # body from stdin
        stdin = json.dumps(body)
    out = subprocess.run(cmd, input=stdin, capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"sf api request failed:\n{out.stderr}")
    return json.loads(out.stdout) if out.stdout.strip() else None


def insert(records):
    """Insert in batches of 200 (the composite collections limit). Returns new ids."""
    ids = []
    for i in range(0, len(records), 200):
        batch = records[i:i + 200]
        results = request("POST", "composite/sobjects",
                          {"allOrNone": False, "records": batch})
        for r in results:
            if r["success"]:
                ids.append(r["id"])
            else:
                print("  insert failed:", r["errors"], file=sys.stderr)
    return ids


def delete_seeded():
    # Orders first: the required Contact lookup restricts deleting contacts that still have orders.
    # DELETE via `sf api request rest` is broken in the beta CLI command, so use Bulk API 2.0.
    for sobject, where in [
        ("Coffee_Order__c", f"Contact__r.Email LIKE '%25@{EMAIL_DOMAIN}'"),
        ("Contact", f"Email LIKE '%25@{EMAIL_DOMAIN}'"),
    ]:
        res = request("GET",
                      f"query?q=SELECT+Id+FROM+{sobject}+WHERE+{where.replace(' ', '+')}")
        ids = [r["Id"] for r in res["records"]]
        if ids:
            with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False) as f:
                f.write("Id\n" + "\n".join(ids))
                csv_path = f.name
            out = subprocess.run(["sf", "data", "delete", "bulk", "-s", sobject,
                                  "-f", csv_path, "-o", ORG_ALIAS, "--wait", "10"],
                                 capture_output=True, text=True)
            os.unlink(csv_path)
            if out.returncode != 0:
                sys.exit(f"bulk delete failed:\n{out.stderr or out.stdout}")
        print(f"deleted {len(ids)} {sobject}")


def build_contacts():
    contacts, emails = [], []
    for i in range(50):
        first, last = FIRST[i], LAST[i % len(LAST)]
        email = f"{first.lower()}.{last.lower()}@{EMAIL_DOMAIN}"
        contacts.append({"attributes": {"type": "Contact"},
                         "FirstName": first, "LastName": last, "Email": email})
        emails.append(email)
    # Five deliberate duplicates: same human, same email, sloppier name.
    # Identity resolution (match on exact email) should collapse each pair.
    for i in range(5):
        first, last = FIRST[i], LAST[i % len(LAST)]
        contacts.append({"attributes": {"type": "Contact"},
                         "FirstName": first[0] + ".", "LastName": last.upper(),
                         "Email": f"{first.lower()}.{last.lower()}@{EMAIL_DOMAIN}"})
    return contacts, emails


def build_orders(contact_ids):
    orders = []
    today = date.today()
    for _ in range(200):
        status = random.choices(
            ["Delivered", "Shipped", "Processing", "Cancelled"],
            weights=[40, 30, 20, 10])[0]
        item, price = random.choice(CATALOG)
        qty = random.randint(1, 3)
        order = {
            "attributes": {"type": "Coffee_Order__c"},
            "Contact__c": random.choice(contact_ids),
            "Status__c": status,
            "Items__c": f"{qty}x {item}",
            "Total_Amount__c": round(qty * price, 2),
        }
        if status in ("Shipped", "Delivered"):
            shipped = today - timedelta(days=random.randint(1, 60))
            order["Ship_Date__c"] = shipped.isoformat()
            order["ETA__c"] = (shipped + timedelta(days=random.randint(2, 7))).isoformat()
            order["Tracking_Number__c"] = f"NIM{random.randint(10_000_000, 99_999_999)}"
        orders.append(order)
    return orders


def main():
    if "--reset" in sys.argv:
        delete_seeded()
    contacts, _ = build_contacts()
    contact_ids = insert(contacts)
    print(f"created {len(contact_ids)} contacts (incl. 5 duplicate pairs for identity resolution)")
    order_ids = insert(build_orders(contact_ids))
    print(f"created {len(order_ids)} coffee orders")


if __name__ == "__main__":
    main()
