import { Auth, initAuthorized, AuthControllor } from '../auth'

describe("Test Auth Controllor", () => {
    it("Auth toBeInstanceOf AuthControllor", () => {
        expect(Auth).toBeInstanceOf(AuthControllor)
    })

    it('initAuthorized is a function', () => {
        expect(typeof initAuthorized).toEqual('function')
    })
})