import Selective from 'selective-edit'
import * as yaml from 'js-yaml'

const bodyEl = document.querySelector('#body')
const bodySourceEl = document.querySelector('#markdownAsText')
const configSourceEl = document.querySelector('#config')
const frontMatterEl = document.querySelector('#frontmatter')
const frontMatterSourceEl = document.querySelector('#yamlAsText')
const editorFormEl = document.querySelector('#editorForm')

const config = configSourceEl.value ? JSON.parse(configSourceEl.value) : {}
const frontMatterSelective = new Selective(frontMatterEl, config)
frontMatterSelective.data = yaml.safeLoad(frontMatterSourceEl.value)
if (!configSourceEl.value) {
  const newConfig = frontMatterSelective.autoFields.config
  frontMatterSelective.config = newConfig
}

const bodyConfig = {
  'fields': [
    {
      'type': 'markdown',
      'key': 'body',
      'label': 'Body',
    },
  ],
}
const bodySelective = new Selective(bodyEl, bodyConfig)
bodySelective.data = {'body': bodySourceEl.value}

editorFormEl.addEventListener('submit', (e) => {
  frontMatterSourceEl.value = yaml.safeDump(frontMatterSelective.value)
  bodySourceEl.value = bodySelective.value.body
})
