declare global {
  namespace NodeJS {
    interface ProcessEnv {
      TWITTER_AUTH_EMAIL: string;
      TWITTER_AUTH_USERNAME: string;
      TWITTER_AUTH_PASSWORD: string;
      TWITTER_AUTH_BIO: string;
      TWITTER_TEST_POST_URL: string;
      TWITTER_TEST_PROFILE_URL: string;
      IMAP_AUTH_HOST: string;
      IMAP_AUTH_USER: string;
      IMAP_AUTH_PASS: string;
      SECRET_PHRASE: string;
      GITHUB_AUTH_EMAIL: string;
      GITHUB_AUTH_PASSWORD: string;
      GITHUB_AUTH_USERNAME: string;
      GITHUB_TEST_PROFILE_URL: string;
      GITHUB_TEST_COMMIT_URL: string;
      NEAR_SECRET_PHRASE: string;

      NEAR_PASSWORD: string;
    }
  }
}

export {};
