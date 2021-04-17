import './style/login.scss'
import { util } from './js/util'

const validMsgMap = {
    username: {
        required: '请输入用户名',
        minLength: '用户名长度不能小于5',
        maxLength: '用户名长度不能大于20',
        validChar: '用户名只能以字母开头，并且不能包含特殊字符'
    },
    password: {
        required: '请输入密码',
        minLength: '密码长度不能小于6',
        maxLength: '密码长度不能大于20',
        validChar: '密码只能以字母开头，并且不能包含特殊字符'
    }
}

type IValidMsgMap = typeof validMsgMap
type IValidMsgMapKey = keyof IValidMsgMap
type IValidMsgMapKind = keyof IValidMsgMap[IValidMsgMapKey]
type IValidtFields = {
    password: string
    username: string
};

function createError(name: IValidMsgMapKey, kind: IValidMsgMapKind) {
    var msg = validMsgMap[name][kind]

    return new Error(msg)
}

function checkField(value: string | undefined, name: IValidMsgMapKey) {
    if (!value) {
        return createError(name, 'required')
    }

    if (value.length < 5) {
        return createError(name, 'minLength')
    }

    if (value.length > 20) {
        return createError(name, 'maxLength')
    }

    if (!/^[a-zA-Z]\w+/.test(value)) {
        return createError(name, 'validChar')
    }

    return
}

function getFieldValue(el: HTMLInputElement) {
    if (el) {
        const field = el.name as IValidMsgMapKey
        const value = el.value
        const validEl = document.getElementById('J-valid-msg_' + field)
        const error = checkField(value, field)

        if (error) {
            if (validEl) {
                validEl.classList.add('visible')
                validEl.innerHTML = error.message
            }
        } else {
            if (validEl) {
                validEl.classList.remove('visible')
            }
            return value
        }
    }

    return
}

function validateFields(fields: Partial<IValidtFields>) {
    for (let name in fields) {
        var el = document.getElementsByName(name)[0] as HTMLInputElement
        var value = getFieldValue(el)
        if (!value) {
            return false
        }

        (fields as any)[name] = value
    }
    return true
}

util.validate = function validate(el: HTMLInputElement) {
    if (el.type === 'password') {
        el.removeAttribute('value')
    }

    getFieldValue(el)
}

util.submit = function clickSubmit() {
    var fields = {
        username: undefined,
        password: undefined
    }

    if (!validateFields(fields)) {
        return false
    }

    util.request({
        url: '/login',
        method: 'POST',
        onOk(res) {
            localStorage.setItem('user', JSON.stringify(res.user))
            window.location.replace('/')
        },
        data: JSON.stringify({
            user: fields.username,
            pass: fields.password
        })
    })

    return false
}
