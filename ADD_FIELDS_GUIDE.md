# Add Fields to Existing Collections

If your collections were created but only have the `id` field, you need to add the following fields manually.

## Questions Collection

Open the **questions** collection in PocketBase admin UI and add these fields:

### 1. question (Text field)
- Click **"+ New Field"** or **"Add Field"**
- Type: **Text**
- Name: `question`
- Required: ✅ **Yes**
- Options:
  - Min length: `1`
  - Max length: `5000`

### 2. responses (JSON field)
- Click **"+ New Field"** or **"Add Field"**
- Type: **JSON**
- Name: `responses`
- Required: ❌ **No** (optional)

### 3. user (Relation field)
- Click **"+ New Field"** or **"Add Field"**
- Type: **Relation**
- Name: `user`
- Required: ✅ **Yes**
- Collection: Select **`users`** from the dropdown
- Options:
  - Max select: `1`
  - Display fields: `email`
  - Cascade delete: ❌ **No**

### 4. created (Auto Date - already exists)
- This field is automatically created by PocketBase, so you don't need to add it manually

---

## User Points Collection

Open the **user_points** collection in PocketBase admin UI and add these fields:

### 1. user (Relation field)
- Click **"+ New Field"** or **"Add Field"**
- Type: **Relation**
- Name: `user`
- Required: ✅ **Yes**
- Unique: ✅ **Yes** (important - ensures one record per user)
- Collection: Select **`users`** from the dropdown
- Options:
  - Max select: `1`
  - Display fields: `email`
  - Cascade delete: ✅ **Yes** (delete points when user is deleted)

### 2. points (Number field)
- Click **"+ New Field"** or **"Add Field"**
- Type: **Number**
- Name: `points`
- Required: ✅ **Yes**
- Options:
  - Min: `0`
  - No max (leave blank)

### 3. created & updated (Auto Date - already exist)
- These fields are automatically created by PocketBase, so you don't need to add them manually

---

## Quick Checklist

### Questions Collection
- [ ] `question` - Text field (required, 1-5000 chars)
- [ ] `responses` - JSON field (optional)
- [ ] `user` - Relation to `users` (required, max 1)
- [ ] `id`, `created`, `updated` - Auto fields (already exist)

### User Points Collection
- [ ] `user` - Relation to `users` (required, unique)
- [ ] `points` - Number field (required, min: 0)
- [ ] `id`, `created`, `updated` - Auto fields (already exist)

---

## Visual Guide

In PocketBase Admin UI:
1. Click on the collection name in the sidebar (e.g., "questions")
2. Click on the **"Fields"** tab or **"Schema"** tab at the top
3. Click **"+ New Field"** or **"Add Field"** button
4. Select the field type and configure as described above
5. Click **"Save"** or **"Create"**

Repeat for each field needed.

---

## After Adding Fields

Once all fields are added, your collections will be ready to use with the application. You can test by:
1. Creating a test record through the API
2. Viewing records in the PocketBase admin UI
3. Running your application and testing the functionality

