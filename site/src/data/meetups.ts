import type { ImageMetadata } from "astro";

import bdLogo from "../assets/images/logos/bd.png";
import dcbitdevsLogo from "../assets/images/logos/dcbitdevs.png";
import shenandoahLogo from "../assets/images/logos/shenandoah.png";
import somdLogo from "../assets/images/logos/somd.png";
import baltimoreLogo from "../assets/images/logos/baltimore.png";
import hollerLogo from "../assets/images/logos/holler.png";
import rvaLogo from "../assets/images/logos/rva.png";

export type Meetup = {
  id: string;
  title: string;
  description: string;
  location: {
    name: string;
    latitude: number;
    longitude: number;
    address: string;
  };
  meetupUrl: string;
  logo: ImageMetadata;
};

// Sourced from: https://github.com/BitcoinDistrict/bitcoindistrict.github.io/blob/main/src/data/meetups.ts
export const meetupsData: Meetup[] = [
  {
    id: "bitcoin-district",
    title: "Bitcoin District",
    description: "Bitcoiners living and working in and around Washington, DC.",
    location: {
      name: "Washington, DC",
      latitude: 38.88215,
      longitude: -77.01606,
      address: "2 15th St NW, Washington, DC 20024",
    },
    meetupUrl: "https://www.meetup.com/bitcoin-district",
    logo: bdLogo,
  },
  {
    id: "dc-bitdevs",
    title: "DC BitDevs",
    description: "Community for discussing and advancing Bitcoin and related protocols.",
    location: {
      name: "Washington, DC",
      latitude: 38.898691,
      longitude: -77.036544,
      address: "1600 Pennsylvania Ave NW, Washington, DC 20500",
    },
    meetupUrl: "https://www.meetup.com/dc-bit-devs",
    logo: dcbitdevsLogo,
  },
  {
    id: "shenandoah-bitcoin-club",
    title: "Shenandoah Bitcoin Club",
    description: "Educating and collaborating on Bitcoin in the Northern Shenandoah Valley.",
    location: {
      name: "Winchester, VA",
      latitude: 39.18506,
      longitude: -78.16507,
      address: "2 S Loudoun St, Winchester, VA 22601",
    },
    meetupUrl: "https://www.meetup.com/shenandoah-bitcoin-club",
    logo: shenandoahLogo,
  },
  {
    id: "baltimore-bitcoin",
    title: "Baltimore Bitcoin",
    description: "Monthly happy hour meetups in Baltimore, Maryland",
    location: {
      name: "Ellicott City, MD",
      latitude: 39.26794,
      longitude: -76.79959,
      address: "8307 Main St, Ellicott City, MD 21043",
    },
    meetupUrl: "https://www.meetup.com/baltimorebitcoin",
    logo: baltimoreLogo,
  },
  {
    id: "hodl-in-the-holler",
    title: "HODL in the Holler",
    description:
      "A series of meetups that will advocate for Bitcoin and Freedom Tech in Appalachian communities.",
    location: {
      name: "Morgantown, WV",
      latitude: 39.630812977719984,
      longitude: -79.95406236308625,
      address: "Morgantown, WV",
    },
    meetupUrl: "https://www.meetup.com/hodl-in-the-holler",
    logo: hollerLogo,
  },
  {
    id: "rva-bitcoiners",
    title: "RVA Bitcoiners",
    description:
      "A group of Bitcoiners in Richmond, Virginia focused on all things Bitcoin and the rapidly growing layer 2 scaling solution, the Lightning Network (LN).",
    location: {
      name: "Richmond, VA",
      latitude: 37.54072108822059,
      longitude: -77.4358249756235,
      address: "Richmond, VA",
    },
    meetupUrl: "https://www.meetup.com/rva-bitcoiners/",
    logo: rvaLogo,
  },
];

