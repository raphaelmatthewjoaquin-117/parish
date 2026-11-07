import type { Language } from './i18n'

type LocalizedText = Record<Language, string>

export type ParishFaq = {
  id: string
  question: LocalizedText
  answer: LocalizedText
  keywords: string[]
  link: LocalizedText
  href: string
}

export const parishFaqs: ParishFaq[] = [
  {
    id: 'service-booking',
    question: {
      en: 'How do I book a parish service?',
      tl: 'Paano ako magbu-book ng serbisyo sa parokya?',
    },
    answer: {
      en: 'Open Services, choose the service you need, and follow the instructions on the page. Availability and requirements can vary, so check the current details there.',
      tl: 'Buksan ang Mga Serbisyo, piliin ang kailangan mo, at sundin ang mga tagubilin sa pahina. Maaaring mag-iba ang availability at mga requirement, kaya tingnan ang kasalukuyang detalye roon.',
    },
    keywords: [
      'book', 'booking', 'appointment', 'sacrament',
      'baptism', 'binyag', 'marriage', 'kasal', 'confirmation', 'kumpil',
      'first communion', 'komunyon', 'funeral', 'libing', 'house blessing', 'basbas ng bahay',
      'magbu-book', 'magbook', 'magpa-appointment',
    ],
    link: { en: 'Go to Services', tl: 'Pumunta sa Mga Serbisyo' },
    href: '/services',
  },
  {
    id: 'certificate-request',
    question: {
      en: 'How do I request a certificate?',
      tl: 'Paano ako hihiling ng sertipiko?',
    },
    answer: {
      en: 'Open Services and choose Certificate. You can request an appointment for a Baptism, Confirmation, Marriage, or Death certificate. No account is needed; the site gives you a reference code to check your request.',
      tl: 'Buksan ang Mga Serbisyo at piliin ang Sertipiko. Maaari kang humiling ng appointment para sa sertipiko ng Binyag, Kumpil, Kasal, o Kamatayan. Hindi kailangan ng account; bibigyan ka ng reference code para masubaybayan ang kahilingan.',
    },
    keywords: [
      'certificate', 'certificates', 'baptismal certificate', 'request a certificate',
      'sertipiko', 'katunayan', 'kopya ng sertipiko', 'birth certificate',
    ],
    link: { en: 'Request a Certificate', tl: 'Humiling ng Sertipiko' },
    href: '/services#certificate',
  },
  {
    id: 'track-request',
    question: {
      en: 'How can I track my request?',
      tl: 'Paano ko masusubaybayan ang aking kahilingan?',
    },
    answer: {
      en: 'Use the request lookup on the Services page and enter the reference code from your confirmation. If you need help with a request, use the Contact Us page.',
      tl: 'Gamitin ang request lookup sa pahina ng Mga Serbisyo at ilagay ang reference code mula sa kumpirmasyon. Kung kailangan mo ng tulong, gamitin ang pahina ng Makipag-ugnayan.',
    },
    keywords: [
      'track', 'tracking', 'status', 'reference code', 'reference number', 'lookup',
      'request status', 'certificate request status', 'subaybayan', 'masubaybayan',
      'katayuan', 'sundan ang kahilingan',
    ],
    link: { en: 'Go to Services', tl: 'Pumunta sa Mga Serbisyo' },
    href: '/services',
  },
  {
    id: 'prayer-request',
    question: {
      en: 'How do I send a prayer request?',
      tl: 'Paano ako magpapadala ng kahilingan sa panalangin?',
    },
    answer: {
      en: 'Open Prayer Requests and use the form on that page to share your intention.',
      tl: 'Buksan ang Mga Kahilingan sa Panalangin at gamitin ang form sa pahinang iyon upang ibahagi ang iyong kahilingan.',
    },
    keywords: [
      'prayer', 'prayer request', 'intention', 'panalangin', 'kahilingan sa panalangin',
      'ipagdasal', 'dasal',
    ],
    link: { en: 'Open Prayer Requests', tl: 'Buksan ang Mga Kahilingan sa Panalangin' },
    href: '/prayerRequests',
  },
  {
    id: 'contact',
    question: {
      en: 'How do I contact the parish?',
      tl: 'Paano ako makikipag-ugnayan sa parokya?',
    },
    answer: {
      en: 'Visit the Contact Us page for the parish’s current contact information and message form.',
      tl: 'Bisitahin ang pahina ng Makipag-ugnayan para sa kasalukuyang impormasyon at form ng mensahe ng parokya.',
    },
    keywords: [
      'contact', 'phone', 'email', 'address', 'office', 'parish office',
      'makipag-ugnayan', 'kontak', 'telepono', 'opisina',
    ],
    link: { en: 'Go to Contact Us', tl: 'Pumunta sa Makipag-ugnayan' },
    href: '/contact',
  },
]

function normalizeQuestion(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function findParishFaq(question: string): ParishFaq | undefined {
  const normalized = normalizeQuestion(question)
  if (!normalized) return undefined

  const query = ` ${normalized} `
  let bestMatch: ParishFaq | undefined
  let bestScore = 0

  for (const faq of parishFaqs) {
    const score = faq.keywords.reduce((total, keyword) => {
      const normalizedKeyword = normalizeQuestion(keyword)
      return total + (query.includes(` ${normalizedKeyword} `) ? normalizedKeyword.split(' ').length : 0)
    }, 0)

    if (score > bestScore) {
      bestMatch = faq
      bestScore = score
    }
  }

  return bestMatch
}
