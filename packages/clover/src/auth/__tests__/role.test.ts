import { RoleAuth, RoleControllor } from '../role'

describe('Test Package Auth Controllor', () => {
    it("RoleAuth toBeInstanceOf RoleControllor", () => {
        expect(RoleAuth).toBeInstanceOf(RoleControllor)
    })
})