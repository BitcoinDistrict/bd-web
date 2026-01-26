export type SiteNavItem =
  | { label: string; href: string }
  | { label: string; href?: string; children: Array<{ label: string; href: string }> };

export type SocialLink = {
  ariaLabel: string;
  icon: string;
  href: string;
};

export type FooterLink = {
  text: string;
  href: string;
  ariaLabel?: string;
};

export type FooterLinks = {
  title: string;
  links: FooterLink[];
};

export const siteConfig = {
  title: "Bitcoin District",
  seo: {
    defaultTitle: "Bitcoin District",
    defaultDescription: "Building a vibrant Bitcoin community through education, events, and collaboration.",
  },
  nav: {
    main: [
      { 
        label: "Events", 
        href: "/events",
        children: [
          { label: "DC BitPlebs", href: "/bitplebs" },
          //{ label: "DC BitDevs", href: "https://dcbitdevs.com" },
          { label: "Book Club", href: "/bookclub" },
        ]
      },
      { label: "Meetups", href: "/meetups" },
      { label: "Podcast", href: "/podcast" },
      { label: "Nostr", href: "/nostr" },
      { label: "News", href: "https://news.bitcoindistrict.org" },
    ] satisfies SiteNavItem[],
    footer: [
      { label: "Home", href: "/" },
      { label: "Events", href: "/events" },
      { label: "Podcast", href: "/podcast" },
    ] satisfies Array<{ label: string; href: string }>,
  },
  social: {
    x: null as string | null,
    nostr: null as string | null,
  },
  socialLinks: [
    { ariaLabel: 'X', icon: 'tabler:brand-x', href: 'https://x.com/BTCDistrict' },
    { ariaLabel: 'Nostr', icon: 'nostr', href: 'https://primal.net/p/npub1mcke7stw5mrqp97lmdu0qdrfcz2uertdsy2n9pzvfnsdutx3hvkq7d5mnw' },
    { ariaLabel: 'Github', icon: 'tabler:brand-github', href: 'https://github.com/BitcoinDistrict' },
  ] satisfies SocialLink[],
  footerData: {
    links: [
      {
        title: 'Meetups 🤝',
        links: [
          { text: 'Bitcoin District', href: 'https://www.meetup.com/bitcoin-district/' },
          { text: 'DC BitDevs', href: 'https://www.meetup.com/dc-bit-devs/' },
          { text: 'Shenandoah Bitcoin Club', href: 'https://www.meetup.com/shenandoah-bitcoin-club/' },
          { text: 'Southern Maryland Bitcoiners', href: 'https://www.meetup.com/southern-maryland-bitcoiners/' },
        ],
      },
      {
        title: 'Friends 🤗',
        links: [
          { text: 'Bitcoin District Initiative', href: 'https://www.bitcoindistrictinitiative.org/' },
          { text: 'Bitcoin Policy Institute', href: 'https://www.btcpolicy.org/' },
          { text: 'PubKey DC', href: 'https://pubkey.com/dc' },
          { text: 'Strategy Hub', href: 'https://strategy.com/hub' },
        ],
      },
    ] satisfies FooterLinks[],
    secondaryLinks: [
      { text: 'Terms', href: '/terms' },
      { text: 'Privacy Policy', href: '/privacy' },
      { text: 'Contact', href: '/contact' },
    ] satisfies FooterLink[],
    newsletter: {
      title: 'Subscribe to our newsletter',
      description: undefined,
      enabled: true,
    },
  },
  footNote: `Copyright © ${new Date().getFullYear()} Bitcoin District · All rights reserved.`,
} as const;

