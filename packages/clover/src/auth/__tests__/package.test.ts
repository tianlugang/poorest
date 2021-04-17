import { PackageControllor, PackageAuth } from '../package'

describe('Test Package Auth Controllor', () => {
    it("PackageAuth toBeInstanceOf PackageControllor", () => {
        expect(PackageAuth).toBeInstanceOf(PackageControllor)
    })
})