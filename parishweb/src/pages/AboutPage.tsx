import '../PagesCSS/AboutPage.css'

export function AboutPage() {
  return (
    <section className="content-section simple-page container py-5">
      <div className="section-heading mb-5">
        <p className="eyebrow">About Us</p>
        <h2>Growing in faith together</h2>
      </div>

      <div className="page-layout row g-4 align-items-start">
        <div className="text-block col-lg-8">
          <p>
            We are a vibrant parish community centered on worship, service, and
            friendship. Our mission is to help people encounter Christ, grow in faith,
            and share God’s love with the wider community.
          </p>
          <p>
            From children’s ministry to adult formation, prayer groups, and outreach,
            every part of parish life is designed to help people belong, pray, and
            serve.
          </p>
          <p>
            We welcome families, visitors, and individuals of every age and stage of
            life. Whether you are new to the area or looking for a parish home, you are
            welcome here.
          </p>
        </div>

        <div className="mini-panel col-lg-4 d-grid gap-3">
          <div className="p-4 border rounded shadow-sm bg-white">
            <strong>2500+</strong>
            <span>active parish families</span>
          </div>
          <div className="p-4 border rounded shadow-sm bg-white">
            <strong>30+</strong>
            <span>ministries and groups</span>
          </div>
          <div className="p-4 border rounded shadow-sm bg-white">
            <strong>120+</strong>
            <span>community volunteers</span>
          </div>
        </div>
      </div>
    </section>
  )
}
