# New Collection Field Specifications

Use this guide to manually add the new collections needed for public ratings and comments.

---

## Collection: `ratings`

### Purpose
Stores individual user ratings for AI model responses. Each user can rate each model's answer to any question.

### Fields:

#### Field 1: `question`
- **Type:** Relation
- **Name:** `question`
- **Required:** ✅ Yes
- **Related Collection:** Select `questions` from the dropdown
- **Options:**
  - Max select: `1`
  - Display fields: `question` (first 50 chars)
  - Cascade delete: ✅ Yes (delete ratings when question is deleted)

#### Field 2: `user`
- **Type:** Relation
- **Name:** `user`
- **Required:** ✅ Yes
- **Related Collection:** Select `users` from the dropdown
- **Options:**
  - Max select: `1`
  - Display fields: `email`
  - Cascade delete: ✅ Yes

#### Field 3: `model`
- **Type:** Text
- **Name:** `model`
- **Required:** ✅ Yes
- **Options:**
  - Min length: `1`
  - Max length: `50`

#### Field 4: `rating`
- **Type:** Number
- **Name:** `rating`
- **Required:** ✅ Yes
- **Options:**
  - Min: `0` (0 means no rating/unrated)
  - Max: `5`

#### Field 5: Unique Constraint
- Create a unique constraint on the combination of `question`, `user`, and `model` fields
- This ensures each user can only have one rating per model per question
- In PocketBase Admin UI: Settings → Collection → Add unique index on `question+user+model`

### Auto Fields:
- `id` - Auto ID
- `created` - Auto Date
- `updated` - Auto Date

---

## Collection: `comments`

### Purpose
Stores user comments on questions.

### Fields:

#### Field 1: `question`
- **Type:** Relation
- **Name:** `question`
- **Required:** ✅ Yes
- **Related Collection:** Select `questions` from the dropdown
- **Options:**
  - Max select: `1`
  - Display fields: `question` (first 50 chars)
  - Cascade delete: ✅ Yes (delete comments when question is deleted)

#### Field 2: `user`
- **Type:** Relation
- **Name:** `user`
- **Required:** ✅ Yes
- **Related Collection:** Select `users` from the dropdown
- **Options:**
  - Max select: `1`
  - Display fields: `email`
  - Cascade delete: ✅ Yes

#### Field 3: `comment`
- **Type:** Text
- **Name:** `comment`
- **Required:** ✅ Yes
- **Options:**
  - Min length: `1`
  - Max length: `5000`

### Auto Fields:
- `id` - Auto ID
- `created` - Auto Date
- `updated` - Auto Date

---

## Quick Setup Checklist

### ratings collection:
- [ ] Create collection named `ratings`
- [ ] Add `question` relation field (to `questions`)
- [ ] Add `user` relation field (to `users`)
- [ ] Add `model` text field
- [ ] Add `rating` number field (min: 0, max: 5)
- [ ] Create unique index on `question+user+model` combination

### comments collection:
- [ ] Create collection named `comments`
- [ ] Add `question` relation field (to `questions`)
- [ ] Add `user` relation field (to `users`)
- [ ] Add `comment` text field (min: 1, max: 5000)

---

## Notes

- The unique constraint on `ratings` ensures users can't rate the same model response twice, but can update their rating
- Comments can be multiple per user per question (users can comment multiple times)
- Both collections will cascade delete when questions or users are deleted

