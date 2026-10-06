import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import './About.css'

function About() {
  const { t } = useTranslation()
  const [imageUrl, setImageUrl] = useState('')
  const [imageDimensions, setImageDimensions] = useState({ width: 1425, height: 1600 })

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

  function handleImageLoad(event) {
    const { naturalWidth, naturalHeight } = event.currentTarget
    setImageDimensions({ width: naturalWidth, height: naturalHeight })
  }

  return (
    <div className="about-page">
      <div className="about-content">
        {imageUrl && (
          <figure className="about-photo-wrapper">
            <img
              className="about-photo"
              src={imageUrl}
              alt={t('about.imageAlt')}
              width={imageDimensions.width}
              height={imageDimensions.height}
              onLoad={handleImageLoad}
            />
          </figure>
        )}

        <div className="about-copy">
          <h1 className="about-title">{t('about.title')}</h1>
          <p className="about-intro">{t('about.intro')}</p>
          <div className="about-paragraphs">
            <p>{t('about.p1')}</p>
            <p>{t('about.p2')}</p>
            <p>{t('about.p3')}</p>
          </div>
          <Link to="/shop" className="btn-primary about-cta">
            {t('about.cta')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default About
