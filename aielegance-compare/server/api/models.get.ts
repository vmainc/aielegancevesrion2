import { parseModelsConfig, publicModels } from '../../lib/compare'

export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  const models = parseModelsConfig(String(config.modelsJson || process.env.AIELEGANCE_MODELS || ''))
  return { models: publicModels(models) }
})
