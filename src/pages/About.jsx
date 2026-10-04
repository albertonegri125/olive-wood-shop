import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import './About.css'

function About() {
  const { t } = useTranslation()
  const [imageUrl, setImageUrl] = useState('')

  useEffect(() => {
    let isCurrent = true

    async function fetchFirstProductImage() {
      const { data, error } = await supabase
        .from('products')
        .select('id, product_images(image_url, display_order)')
        .eq('active', true)
        .order('created_at', { ascending: true })

      if (error || !isCurrent) return

      for (const product of data ?? []) {
        const firstImage = [...(product.product_images ?? [])].sort(
          (left, right) => (left.display_order ?? 0) - (right.display_order ?? 0)
        )[0]

        if (firstImage?.image_url) {
          setImageUrl(firstImage.image_url)
          break
        }
      }
    }

    fetchFirstProductImage()

    return () => {
      isCurrent = false
    }
  }, [])

  return (
    <div className="about-page">
      <h1 className="about-title">{t('about.title')}</h1>
      <p className="about-intro">{t('about.intro')}</p>

      <div className="about-content">
        {imageUrl && (
          <figure className="about-photo-wrapper">
            <img
              className="about-photo"
              src={imageUrl}
              alt="Ramo d'ulivo e scalpello da falegname"
            />
          </figure>
        )}

        <div className="about-blocks">
          <section className="about-block">
            <h2 className="about-block-title">{t('about.materialTitle')}</h2>
            <p className="about-paragraph">{t('about.material')}</p>
          </section>
          <section className="about-block">
            <h2 className="about-block-title">{t('about.methodTitle')}</h2>
            <p className="about-paragraph">{t('about.method')}</p>
          </section>
          <section className="about-block">
            <h2 className="about-block-title">{t('about.promiseTitle')}</h2>
            <p className="about-paragraph">{t('about.promise')}</p>
          </section>
          <Link to="/shop" className="btn-primary about-cta">
            {t('about.cta')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default About
