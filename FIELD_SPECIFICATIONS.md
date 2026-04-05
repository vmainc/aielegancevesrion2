# Field Specifications for PocketBase Collections

Use this guide to manually add fields to your collections in the PocketBase admin UI.

---

## Collection: `questions`

### Field 1: `question`
- **Type:** Text
- **Name:** `question`
- **Required:** ✅ Yes
- **Options:**
  - Min length: `1`
  - Max length: `5000`

### Field 2: `responses`
- **Type:** JSON
- **Name:** `responses`
- **Required:** ❌ No (optional)

### Field 3: `user`
- **Type:** Relation
- **Name:** `user`
- **Required:** ✅ Yes
- **Unique:** ❌ No
- **Related Collection:** Select `users` from the dropdown
- **Options:**
  - Max select: `1`
  - Display fields: `email`
  - Cascade delete: ❌ No

### Auto Fields (already exist, no action needed):
- `id` - Auto ID
- `created` - Auto Date
- `updated` - Auto Date

---

## Collection: `user_points`

### Field 1: `user`
- **Type:** Relation
- **Name:** `user`
- **Required:** ✅ Yes
- **Unique:** ✅ Yes (important!)
- **Related Collection:** Select `users` from the dropdown
- **Options:**
  - Max select: `1`
  - Display fields: `email`
  - Cascade delete: ✅ Yes

### Field 2: `points`
- **Type:** Number
- **Name:** `points`
- **Required:** ✅ Yes
- **Options:**
  - Min: `0`
  - Max: (leave blank/no limit)

### Auto Fields (already exist, no action needed):
- `id` - Auto ID
- `created` - Auto Date
- `updated` - Auto Date

---

## Quick Summary

### questions collection needs 3 fields:
1. `question` - Text (required, 1-5000 chars)
2. `responses` - JSON (optional)
3. `user` - Relation to `users` (required, max 1)

### user_points collection needs 2 fields:
1. `user` - Relation to `users` (required, unique, cascade delete)
2. `points` - Number (required, min: 0)

---

## Step-by-Step in PocketBase Admin UI

1. Navigate to: `http://127.0.0.1:8090/_/`
2. Click on the collection name (e.g., "questions") in the sidebar
3. Click the **"Fields"** or **"Schema"** tab
4. Click **"+ New Field"** or **"Add Field"** button
5. Fill in the field details as specified above
6. Click **"Save"** or **"Create"**
7. Repeat for each field

That's it! Once all fields are added, your collections will be ready to use.

