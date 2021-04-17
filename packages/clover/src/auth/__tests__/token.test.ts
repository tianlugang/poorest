import { Token, TokenControllor } from '../token'

describe('Test Token Controllor', () => {
    it("Token toBeInstanceOf TokenControllor", () => {
        expect(Token).toBeInstanceOf(TokenControllor)
    })
})