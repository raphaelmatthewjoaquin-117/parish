const galleryItems = ['Faith', 'Family', 'Music', 'Community', 'Worship', 'Celebration']

export function GalleryPage() {
  return (
    <section className="content-section simple-page">
      <div className="section-heading">
        <p className="eyebrow">Gallery</p>
        <h2>Life in our parish</h2>
      </div>

      <div className="gallery-grid">
        {galleryItems.map((item, index) => (
          <div key={item} className={`gallery-item item-${index + 1}`}>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
