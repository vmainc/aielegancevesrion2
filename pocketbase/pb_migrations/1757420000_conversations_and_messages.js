/// <reference path="../pb_data/types.d.ts" />
/**
 * User conversation history (Studio Guide) + public email/password registration.
 * Applied automatically when PocketBase starts from the `pocketbase/` directory.
 *
 * Production installs that only use `npm run setup-db` get the same collections
 * from scripts/setup-collections.js — this file is the reproducible local path.
 */
migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  users.listRule = 'id = @request.auth.id'
  users.viewRule = 'id = @request.auth.id'
  users.createRule = ''
  users.updateRule = 'id = @request.auth.id'
  users.deleteRule = 'id = @request.auth.id'
  app.save(users)

  const ownerRule = '@request.auth.id != "" && user = @request.auth.id'
  const messageRule =
    '@request.auth.id != "" && user = @request.auth.id && conversation.user = @request.auth.id'

  const conversations = new Collection({
    name: 'conversations',
    type: 'base',
    listRule: ownerRule,
    viewRule: ownerRule,
    createRule: ownerRule,
    updateRule: ownerRule,
    deleteRule: ownerRule,
    fields: [
      {
        type: 'relation',
        name: 'user',
        required: true,
        maxSelect: 1,
        collectionId: users.id,
        cascadeDelete: true
      },
      {
        type: 'text',
        name: 'title',
        required: true,
        max: 200
      }
    ]
  })
  app.save(conversations)

  const messages = new Collection({
    name: 'messages',
    type: 'base',
    listRule: messageRule,
    viewRule: messageRule,
    createRule: messageRule,
    updateRule: messageRule,
    deleteRule: messageRule,
    fields: [
      {
        type: 'relation',
        name: 'conversation',
        required: true,
        maxSelect: 1,
        collectionId: conversations.id,
        cascadeDelete: true
      },
      {
        type: 'relation',
        name: 'user',
        required: true,
        maxSelect: 1,
        collectionId: users.id,
        cascadeDelete: true
      },
      {
        type: 'select',
        name: 'role',
        required: true,
        maxSelect: 1,
        values: ['user', 'assistant', 'system']
      },
      {
        type: 'text',
        name: 'content',
        required: true,
        max: 20000
      },
      {
        type: 'text',
        name: 'model',
        required: false,
        max: 200
      }
    ]
  })
  return app.save(messages)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('messages'))
  } catch (_) {}
  try {
    app.delete(app.findCollectionByNameOrId('conversations'))
  } catch (_) {}
})
