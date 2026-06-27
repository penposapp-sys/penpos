import { Template } from '../TemplateTypes';

export const restaurantTemplate: Template = {
  id: 'restaurant',
  name: 'Klasik Restoran',
  description: 'Şık bir restoran için tasarlanmış, menü, galeri ve rezervasyon odaklı template',
  category: 'restaurant',
  thumbnail: '🍽️',
  tags: ['restoran', 'kafe', 'yiyecek'],
  theme: {
    primaryColor: '#dc2626', // Kırmızı
    secondaryColor: '#1f2937',
    fontFamily: 'Georgia, serif',
    borderRadius: '4px',
  },
  blocks: [
    {
      type: 'AnnouncementBar',
      props: {
        text: '🎉 Her Cuma canlı müzik eşliğinde özel akşam yemeği!',
        bgColor: '#fef3c7',
        textColor: '#92400e',
        link: '',
      },
    },
    {
      type: 'Hero',
      props: {
        title: 'Lezzetin Adresi',
        subtitle: 'Geleneksel tatlar, modern sunum. 1985\'den beri hizmetinizdeyiz.',
        btnText: 'Menüyü İncele',
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Öne Çıkan Lezzetlerimiz',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'RestaurantMenu',
      props: {
        showImages: true,
      },
    },
    {
      type: 'SpacerBlock',
      props: { height: '40px' },
    },
    {
      type: 'GalleryBlock',
      props: {
        columns: 4,
        gap: 12,
        images: [
          'https://picsum.photos/seed/r1/400',
          'https://picsum.photos/seed/r2/400',
          'https://picsum.photos/seed/r3/400',
          'https://picsum.photos/seed/r4/400',
          'https://picsum.photos/seed/r5/400',
          'https://picsum.photos/seed/r6/400',
          'https://picsum.photos/seed/r7/400',
          'https://picsum.photos/seed/r8/400',
        ],
      },
    },
    {
      type: 'StatsBlock',
      props: {
        items: [
          { value: '35+', label: 'Yıllık Tecrübe' },
          { value: '200+', label: 'Özgün Tarif' },
          { value: '50K+', label: 'Mutlu Misafir' },
          { value: '4.9', label: 'Ortalama Puan' },
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Misafirlerimiz Ne Diyor?',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'TestimonialsBlock',
      props: {
        items: [
          {
            name: 'Ahmet Yılmaz',
            role: 'Düzenli Müşteri',
            text: 'İstanbul\'un en iyi restoranlarından biri. Köfteleri efsane!',
            avatar: 'https://picsum.photos/seed/u1/100',
          },
          {
            name: 'Ayşe Kaya',
            role: 'Food Blogger',
            text: 'Atmosfer, servis, lezzet... Her şey mükemmel.',
            avatar: 'https://picsum.photos/seed/u2/100',
          },
          {
            name: 'Mehmet Demir',
            role: 'İş İnsanı',
            text: 'İş yemekleri için ideal, profesyonel hizmet.',
            avatar: 'https://picsum.photos/seed/u3/100',
          },
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Bize Ulaşın',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'MapBlock',
      props: {
        address: 'İstiklal Caddesi, Beyoğlu, İstanbul',
      },
    },
    {
      type: 'ContactForm',
      props: {
        title: 'Rezervasyon Yapın',
        btnText: 'Rezervasyon Talebi Gönder',
      },
    },
    {
      type: 'SocialBlock',
      props: {
        size: 32,
        links: [
          { platform: 'instagram', url: 'https://instagram.com' },
          { platform: 'facebook', url: 'https://facebook.com' },
          { platform: 'whatsapp', url: 'https://wa.me/' },
        ],
      },
    },
  ],
};