import * as fs from 'fs'

type IJsonObject = NonNullable<Record<string | number, any>>

const toJson = (content: string) => {
    return require('js-yaml').load(content, {
        json: true
    })
}

const toYaml = (jsonLike: IJsonObject) => {
    return require('js-yaml').dump(jsonLike, {
        indent: 2
    })
}

const readJson = (yamlPath: string) => {
    let yamlContent = fs.readFileSync(yamlPath, 'utf8')

    return require('js-yaml').load(yamlContent, {
        json: true
    })
}

const writeJson = (dest: string, jsonLike: IJsonObject) => {
    const yamlContent = toYaml(jsonLike)

    fs.writeFileSync(dest, yamlContent)
}

export const Yaml = { readJson, toJson, toYaml, writeJson }  