import { validateTaxonomy } from './taxonomy.mjs'

const errors = validateTaxonomy()

if (errors.length > 0) {
  console.error(`分类数据检查失败，共 ${errors.length} 项：`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('分类数据检查通过。')
