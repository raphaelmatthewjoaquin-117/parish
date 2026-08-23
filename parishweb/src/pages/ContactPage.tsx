export function ContactPage() {
  return (
    <section className="content-section simple-page">
      <div className="section-heading">
        <p className="eyebrow">Contact Us</p>
        <h2>We would love to hear from you</h2>
      </div>

      <div className="contact-grid">
        <div className="contact-card">
          <h3>Visit</h3>
          <p>145 Church Avenue</p>
          <p>Saint John Parish</p>
          <p>Open Monday to Saturday</p>
        </div>

        <div className="contact-card">
          <h3>Call</h3>
          <p>(555) 123-4567</p>
          <p>office@saintjohnparish.org</p>
        </div>

        <form className="contact-form">
          <input type="text" placeholder="Your name" />
          <input type="email" placeholder="Your email" />
          <textarea placeholder="Your message" rows={4} />
          <button type="submit">Send Message</button>
        </form>
      </div>
    </section>
  )
}
