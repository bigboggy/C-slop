import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'C-slop',
  tagline: 'Write web apps in 80% fewer tokens with C~slop',
  favicon: 'img/C-Slop-logo.svg',

  future: {
    v4: true,
  },

  url: 'https://c-slop.dev',
  baseUrl: '/',

  organizationName: 'c-slop',
  projectName: 'c-slop',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/bigboggy/C-slop/tree/main/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/c-slop-social.png',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      logo: {
        alt: 'C-slop Logo',
        src: 'img/C-Slop-logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/docs/examples',
          label: 'Examples',
          position: 'left',
        },
        {
          to: '/docs/playground',
          label: 'Playground',
          position: 'left',
        },
        {
          href: 'https://github.com/bigboggy/C-slop',
          position: 'left',
          className: 'header-github-link',
          'aria-label': 'GitHub repository',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Learn',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/intro',
            },
            {
              label: 'Syntax Reference',
              to: '/docs/syntax',
            },
            {
              label: 'Examples',
              to: '/docs/examples',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Discord',
              href: 'https://discord.gg/c-slop',
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/c_slop',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/bigboggy/C-slop',
            },
            {
              label: 'Releases',
              href: 'https://github.com/bigboggy/C-slop/releases',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} C-slop. Built for machines, loved by developers.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
