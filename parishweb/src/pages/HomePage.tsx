export function HomePage() {
  return (
    <>
      <section className="hero" id="home">
        <div className="hero-copy">
          <p className="eyebrow">A place of prayer, hope, and belonging</p>
          <h1>Welcome to Our Parish</h1>
          <p className="lead">
            We are a welcoming Catholic community rooted in faith, service, and
            fellowship. Join us for worship, family events, and meaningful moments.
          </p>

          <div className="button-row">
            <a href="/contact" className="primary-btn">
              Plan Your Visit
            </a>
            <a href="/about" className="secondary-btn">
              Learn More
            </a>
          </div>

          <ul className="hero-meta">
            <li>Sunday Mass</li>
            <li>Prayer Groups</li>
            <li>Community Outreach</li>
          </ul>
        </div>

        <div className="hero-card">
          <p className="card-label">This Week</p>
          <h2>Mass Schedule</h2>
          <div className="schedule-item">
            <span>Saturday</span>
            <strong>5:30 PM</strong>
          </div>
          <div className="schedule-item">
            <span>Sunday</span>
            <strong>8:00 AM</strong>
          </div>
          <div className="schedule-item">
            <span>Sunday</span>
            <strong>10:30 AM</strong>
          </div>
        </div>
      </section>

      <section className="content-section" id="about-us">
        <div className="section-heading">
          <p className="eyebrow">About Us</p>
          <h2>Growing in faith together</h2>
        </div>

        <div className="about-grid">
          <div className="text-block">
            <p>
              We are a vibrant parish community that welcomes families, young adults,
              and visitors with open hearts. Through worship, service, and friendship,
              we seek to live out the Gospel in everyday life.
            </p>
            <p>
              From children’s formation to senior outreach, every ministry is built on
              faith, compassion, and belonging.
            </p>
          </div>

          <div className="mini-panel">
            <div>
              <strong>2500+</strong>
              <span>active parish families</span>
            </div>
            <div>
              <strong>30+</strong>
              <span>ministries and groups</span>
            </div>
            <div>
              <strong>120+</strong>
              <span>community volunteers</span>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
