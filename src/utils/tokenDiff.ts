import { tokenize } from './normalize';

export interface TokenDiff {
  match: boolean;
  mismatchIndex: number;
  expectedToken?: string;
  userToken?: string;
}

const cleanToken = (token: string) => token.replace(/[^\w']/g, '').toLowerCase();

export function tokenDiff(expectedSentence: string, userSentence: string): TokenDiff {
  const expectedTokens = tokenize(expectedSentence);
  const userTokens = tokenize(userSentence);

  const length = Math.max(expectedTokens.length, userTokens.length);

  for (let i = 0; i < length; i += 1) {
    const expected = expectedTokens[i];
    const received = userTokens[i];
    if (!expected) {
      return {
        match: false,
        mismatchIndex: i,
        expectedToken: '',
        userToken: received
      };
    }
    if (!received) {
      return {
        match: false,
        mismatchIndex: i,
        expectedToken: expected,
        userToken: ''
      };
    }
    if (cleanToken(expected) !== cleanToken(received)) {
      return {
        match: false,
        mismatchIndex: i,
        expectedToken: expected,
        userToken: received
      };
    }
  }

  return {
    match: true,
    mismatchIndex: -1
  };
}
