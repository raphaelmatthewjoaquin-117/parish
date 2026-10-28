export type PrayerDetails = {
  id: number
  name: string
  category: string
  request: string
  createdAt: string
  anonymous?: boolean
  shareWithCommunity?: boolean
  isApproved?: boolean
}

export const getPrayerCategoryColor = (category: string): string => {
  switch (category) {
    case 'healing':
      return '#4caf50'
    case 'thanksgiving':
      return '#2196f3'
    case 'guidance':
      return '#ff9800'
    case 'family':
      return '#9c27b0'
    case 'deceased':
      return '#757575'
    default:
      return '#d4af37'
  }
}
