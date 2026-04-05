# Setting Up Unique Constraint for user_points.user

The `user` field in the `user_points` collection should be unique to ensure each user has only one points record.

## Method 1: Field-Level Unique Setting (if available)

1. Click the **gear icon** (⚙️) next to the `user` field in the `user_points` collection
2. Look for a **"Unique"** checkbox or toggle
3. Enable it and save

## Method 2: Unique Index (Recommended)

If there's no field-level unique option, create a unique index:

1. Scroll down to the **"Unique constraints and indexes"** section at the bottom
2. Click **"+ New index"** button
3. Configure the index:
   - **Index name:** (optional, or leave auto-generated)
   - **Fields:** Select `user` from the dropdown
   - **Type:** Select **"Unique"**
4. Click **"Create"** or **"Save"**

After creating the unique index, PocketBase will prevent duplicate `user` values in the `user_points` collection.

---

**Why this matters:** The code uses `getFirstListItem` to find a user's points record. If multiple records exist for the same user, it could cause data inconsistencies. The unique constraint ensures data integrity.

