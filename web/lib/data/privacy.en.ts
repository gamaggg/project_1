import { OPERATOR, type PrivacyDoc } from '@/lib/data/privacy.shared'

export const PRIVACY_EN: PrivacyDoc = {
  lang: 'en',
  title: 'Privacy Policy',
  metaDescription: 'What data RANGE collects, why, who receives it and how to have it deleted.',
  updated: 'In effect since 26 October 2026',
  intro:
    'RANGE (the catchrange.com website, the Telegram bot and the mini app) is a map game for anglers. Here, briefly and without legal fog: what data we collect, why, who receives it and how to delete it.',
  sections: [
    {
      title: 'Who is responsible for your data',
      blocks: [
        `Data operator: ${OPERATOR.name}.`,
        `You can contact us through the ${OPERATOR.bot} bot (the support section in the app) or by email at ${OPERATOR.email}.`,
        'This policy is the same for every city and country where RANGE runs. When we add a new city, the policy stays the same.',
      ],
    },
    {
      title: 'What data we collect',
      blocks: [
        'Account:',
        [
          'your email address, if you sign in by email;',
          'your numeric Telegram ID, name and @username from Telegram, if you sign in with Telegram;',
          'your chat ID with the bot, if you pressed «Start» (needed to send you notifications).',
        ],
        'Profile:',
        [
          'the name you chose, your avatar, city, «about me» text, sector colour and the cosmetics you bought;',
          'your date of birth and gender, if you entered them (these fields are optional).',
        ],
        'Catches and activity:',
        [
          'the catch photo, fish species, length, weight, method, bait and time of the catch;',
          'the sector where you caught the fish. A sector is a hexagon on the map about 600 metres across; we do not store the exact coordinates of a catch;',
          'the weather at the time of the catch: we get it from a weather service using the sector’s coordinates, not yours;',
          'follows, likes, comments, clan chat messages, photo reports and support requests (the text and photo, if you attach one);',
          'fishing start and end marks, if you use the reminders in Telegram.',
        ],
        'Your device location. The app asks for it when you record a catch, and only to check that you are near the sector (within about 400 metres). It is a one-time check at the moment you tap: we do not track you in the background and we do not store your coordinates with the catch.',
        'Personal diary. If you add a photo from your gallery to the diary, the app reads the date and place of the shot from the file (the photo’s metadata) and writes them into your diary. The diary is visible only to you.',
        'Technical data:',
        [
          'a random device and session ID and usage events (which screens were opened, at which sign-up step a person stopped, whether the camera was opened): we use them to count statistics and find where the app is inconvenient;',
          'error reports (the error text, network type, your account if you are signed in);',
          'your IP address and browser details, which the hosting and the services listed in section 6 inevitably see.',
        ],
      ],
    },
    {
      title: 'Your consent',
      blocks: [
        'By ticking the box at sign-up, «I accept the terms of use and the privacy policy», you:',
        [
          'confirm that you are at least 14 years old;',
          'accept the terms of use and this policy;',
          'agree to the processing of your data as described here, including its transfer to the services in section 6 outside your country.',
        ],
        'By pressing «Start» in our Telegram bot, you agree to receive notifications and messages from RANGE: about your sectors and catches, rewards, weekly results and project news. You can turn them off at any time: in «Profile» or by stopping the bot.',
        'You can withdraw your consent by deleting your account (section 8).',
      ],
    },
    {
      title: 'Why we use it',
      blocks: [
        [
          'to make the app work: sign-in, the map, sectors, coins, clans, rankings, the feed;',
          'to send notifications in Telegram;',
          'to protect the game: check that you are near a sector, handle reports, block cheating and bots (a «you are not a robot» check runs at sign-in);',
          'to answer your requests;',
          'to understand how people use the app and to improve it.',
        ],
        'We do not sell your data and we do not show you third-party advertising.',
      ],
    },
    {
      title: 'What other players see',
      blocks: [
        [
          'Everyone sees: your name, avatar, city, «about me», statistics, sectors, follows, catches with photos, likes and comments.',
          'Only you see (and administrators, when they handle a report or your request): your date of birth, gender, your diary, email address, Telegram ID, support requests.',
        ],
        'Catch photos and avatars are kept in public storage: anyone who knows the exact link to a file can open it without signing in to the app. If you published something you should not have, delete the catch or write to us.',
      ],
    },
    {
      title: 'Who else receives data',
      blocks: [
        'We use third-party services. Each receives only what it needs to work:',
        [
          'Supabase: the database, account sign-in and photo storage. The server is in Ireland (EU);',
          'Vercel: hosting of the website and server functions, and anonymous visit statistics;',
          'Mapbox: the map. It receives your IP address and the map area you are viewing;',
          'Open-Meteo: weather and bite forecast. It receives the coordinates of a sector or city and, for requests made from the app, your IP address;',
          'Fishial: fish species suggestion. When you record a catch, the photo is sent for recognition through our server;',
          'Cloudflare (Turnstile): the «you are not a robot» check at sign-in;',
          'Telegram: sign-in with Telegram and notifications;',
          'GitHub: storage of our encrypted nightly database backups (without photos).',
        ],
        'The servers of these services are outside Russia and Georgia. Apart from these services and cases where the law requires it, we do not pass your data to anyone.',
      ],
    },
    {
      title: 'How long we keep data',
      blocks: [
        'As long as you have an account. After you delete your account we delete your profile, catches, comments, follows and related records, and remove photo and avatar files from storage within 30 days. Clan chat messages remain, but without your name. In nightly database backups, deleted data may remain for up to 30 more days, after which the backups are deleted.',
        'Technical logs (usage events and errors) are kept as long as needed to run and analyse the service. After your account is deleted they are detached from you and remain only as anonymous statistics.',
      ],
    },
    {
      title: 'Your rights and how to use them',
      blocks: [
        [
          'To find out what data we hold about you and get a copy: write to us.',
          'To correct your name, avatar, city, «about me», date of birth and gender: in «Profile».',
          'To delete your account and data: write to us from the sign-in method you registered with. We will reply within 30 days.',
          'To turn off notifications: in «Profile» (Telegram notifications) or stop the bot.',
          'To withdraw access to your location: in the settings of your phone, browser or Telegram. You will then not be able to record a catch in the app; everything else keeps working.',
        ],
      ],
    },
    {
      title: 'Age',
      blocks: ['The service may be used from the age of 14. If you learn that a child under 14 has registered, write to us and we will delete the account.'],
    },
    {
      title: 'How we protect data',
      blocks: [
        'The connection to the site is protected (HTTPS). Access to data in the database is limited by rules: an ordinary player sees only their own private data and other people’s public data. Administrator rights are limited and their actions are logged. Nightly database backups are encrypted. Nobody can guarantee total security, but we try and we fix weak spots when we find them.',
      ],
    },
    {
      title: 'Cookies and browser storage',
      blocks: [
        'We do not use advertising cookies or trackers. The browser stores: your sign-in data, interface settings, a random device ID and a copy of the app so it works without a network.',
      ],
    },
    {
      title: 'Changes to this policy',
      blocks: ['If we change this policy we will update the date at the top of the page, and we will tell you about significant changes in the app.'],
    },
  ],
}
