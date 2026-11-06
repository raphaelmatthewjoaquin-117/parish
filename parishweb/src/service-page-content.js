export function isValidServicePageContent(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return false;

  const entries = Object.entries(content);
  return entries.length <= 30 && entries.every(([serviceKey, serviceContent]) => {
    if (!/^(certificate|[1-9]\d{0,9})$/.test(serviceKey)
      || !serviceContent || typeof serviceContent !== 'object' || Array.isArray(serviceContent)
      || typeof serviceContent.description !== 'string' || serviceContent.description.length > 5000) {
      return false;
    }

    const image = serviceContent.backgroundImage;
    return image === undefined || image === ''
      || (typeof image === 'string' && image.length <= 2000
        && (/^https?:\/\//i.test(image) || image.startsWith('/assets/') || image.startsWith('/uploads/')));
  });
}
