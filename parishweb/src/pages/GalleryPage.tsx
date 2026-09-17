import testImage from '../images/test.jpg'
import test2Image from '../images/test 2.jpg'
import test3Image from '../images/test3.jpg'
import test4Image from '../images/test4.jpg'
import test5mage from  '../images/test5.jpg'
import test6Image from '../images/test6.jpg'

const galleryItems = [
  { title: 'Faith', image: testImage },
  { title: 'Family', image: test2Image },
  { title: 'Music', image: test3Image },
  { title: 'Community', image: test4Image },
  { title: 'Service', image: test5mage },
  { title: 'Marriage', image: test6Image },
]



export function GalleryPage() {
  return (
    <section className="content-section simple-page">
      <div className="section-heading">
        <p className="eyebrow">Gallery</p>
        <h2>Life in our parish</h2>
      </div>

      <div className="gallery-grid">
        {galleryItems.map((item, index) => (
          <div
            key={item.title}
            className={`gallery-item item-${index + 1}`}
            style={{
              backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.12), rgba(0,0,0,0.4)), url(${item.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <span>{item.title}</span>
          </div>
        ))}
      </div>
    </section>
  )
}