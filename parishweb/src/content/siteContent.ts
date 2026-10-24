import { translateText, type Language } from '../i18n'
import testImage from '../images/test.jpg'
import test2Image from '../images/test 2.jpg'
import test3Image from '../images/test3.jpg'
import test4Image from '../images/test4.jpg'
import test5Image from '../images/test5.jpg'
import test6Image from '../images/test6.jpg'

export type AboutContent = {
  heading: string
  headingTl?: string
  paragraphs: string[]
  paragraphsTl?: string[]
  stats: Array<{ value: string; label: string; labelTl?: string }>
  intro?: string
  introTl?: string
  heroImage?: string
  timeline?: Array<{ year: string; title: string; titleTl?: string; description: string; descriptionTl?: string }>
  quote?: { text: string; textTl?: string; attribution?: string }
}

export type ContactCard = {
  type: 'visit' | 'call' | 'email'
  title: string
  titleTl?: string
  // For call and email cards, the first line is used as the link target.
  lines: string[]
  linesTl?: string[]
}

export type ContactContent = {
  eyebrow?: string
  eyebrowTl?: string
  heading: string
  headingTl?: string
  description?: string
  descriptionTl?: string
  cards: ContactCard[]
  formTitle?: string
  formTitleTl?: string
  formDescription?: string
  formDescriptionTl?: string
}

export type GalleryPhoto = string | { url: string; description?: string; descriptionTl?: string }

export function galleryPhotoUrl(photo: GalleryPhoto): string {
  return typeof photo === 'string' ? photo : photo.url
}

export function galleryPhotoDescription(photo: GalleryPhoto): string {
  return typeof photo === 'string' ? '' : (photo.description ?? '')
}

export function galleryPhotoDescriptionTl(photo: GalleryPhoto): string {
  return typeof photo === 'string' ? '' : (photo.descriptionTl ?? '')
}

export type GalleryContent = {
  heading: string
  headingTl?: string
  items: Array<{ id: string; title: string; titleTl?: string; image: string; photos?: GalleryPhoto[] }>
}

export type NewsContent = {
  articles: Array<{
    id: string
    title: string
    titleTl?: string
    body: string
    bodyTl?: string
    date?: string
    image?: string
    link?: string
  }>
}

export type FooterContent = {
  parishTitle: string
  addressLines: string[]
  scheduleTitle: string
  scheduleLines: string[]
  officeHoursTitle: string
  officeHoursLines: string[]
  contactTitle: string
  contactIntro: string
  phoneNumbers: string[]
  email: string
  quickLinksTitle: string
  quickLinks: Array<{ label: string; path: string }>
  copyright: string
}

// Uses the admin-entered Tagalog text, falling back to the built-in dictionary, then English.
export function localize(english: string, tagalog: string | undefined, language: Language): string {
  if (language !== 'tl') return english
  return tagalog?.trim() ? tagalog : translateText(english, 'tl')
}

export const defaultAboutContent: AboutContent = {
  heading: 'Growing in faith together',
  intro: 'A Dominican parish in Quezon City devoted to prayer, preaching, worship, and service.',
  timeline: [
    { year: 'Late 1500s', title: 'Dominicans in Manila', description: 'The Dominican Order establishes its presence in Manila.' },
    { year: '1972', title: 'Parish established', description: 'On February 23, Santo Domingo Parish is canonically established with its own identity.' },
    { year: '1983', title: 'A pastor of its own', description: 'Fr. Quirico Pedregosa, Jr., O.P. becomes the first pastor not also serving as prior.' },
    { year: 'Today', title: 'A living community', description: 'An active parish of the Diocese of Cubao, celebrating Mass, sacraments, and the feast of La Naval de Manila.' },
  ],
  paragraphs: [
    'We are a vibrant parish community centered on worship, service, and friendship. Our mission is to help people encounter Christ, grow in faith, and share God’s love with the wider community.',
    'From children’s ministry to adult formation, prayer groups, and outreach, every part of parish life is designed to help people belong, pray, and serve.',
    'We welcome families, visitors, and individuals of every age and stage of life. Whether you are new to the area or looking for a parish home, you are welcome here.',
  ],
  stats: [
    { value: '2500+', label: 'active parish families' },
    { value: '30+', label: 'ministries and groups' },
    { value: '120+', label: 'community volunteers' },
  ],
}

export const defaultContactContent: ContactContent = {
  eyebrow: 'Contact Us',
  heading: 'We would love to hear from you',
  description: "Get in touch with our parish community. We're here to help answer any questions you may have.",
  cards: [
    { type: 'visit', title: 'Visit Us', lines: ['145 Church Avenue', 'Saint John Parish', 'Open Monday to Saturday', '9:00 AM - 5:00 PM'] },
    { type: 'call', title: 'Call Us', lines: ['(555) 123-4567', 'Monday - Friday', '9:00 AM - 4:00 PM'] },
    { type: 'email', title: 'Email Us', lines: ['office@saintjohnparish.org', 'We respond within 24 hours'] },
  ],
  formTitle: 'Send us a message',
  formDescription: "Fill out the form below and we'll get back to you as soon as possible.",
}

export const defaultGalleryContent: GalleryContent = {
  heading: 'Life in our parish',
  items: [
    { id: 'faith', title: 'Faith', image: testImage },
    { id: 'family', title: 'Family', image: test2Image },
    { id: 'music', title: 'Music', image: test3Image },
    { id: 'community', title: 'Community', image: test4Image },
    { id: 'service', title: 'Service', image: test5Image },
    { id: 'marriage', title: 'Marriage', image: test6Image },
  ],
}

export const defaultFooterContent: FooterContent = {
  parishTitle: 'Santo Domingo Church',
  addressLines: [
    'National Shrine of Our Lady of the Most Holy Rosary',
    'Quezon City, Philippines',
  ],
  scheduleTitle: 'Service Times',
  scheduleLines: [
    'Saturday: 5:30 PM',
    'Sunday: 8:00 AM',
    'Sunday: 10:30 AM',
    'Weekday: 7:00 AM',
  ],
  officeHoursTitle: 'Parish Office',
  officeHoursLines: ['Monday to Friday: 9:00 AM - 5:00 PM'],
  contactTitle: 'Contact Us',
  contactIntro: 'For inquiries, please contact the parish office.',
  phoneNumbers: ['(555) 123-4567'],
  email: 'office@saintjohnparish.org',
  quickLinksTitle: 'Quick Links',
  quickLinks: [
    { label: 'Home', path: '/' },
    { label: 'About Us', path: '/about' },
    { label: 'Contact', path: '/contact' },
    { label: 'Prayer Requests', path: '/prayerRequests' },
    { label: 'Certificate Request', path: '/services#certificate' },
  ],
  copyright: '© 2026 Santo Domingo Parish. All rights reserved.',
}
