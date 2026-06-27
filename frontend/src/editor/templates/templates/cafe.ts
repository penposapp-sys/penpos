import { Template } from '../TemplateTypes';

export const cafeTemplate: Template = {
  id: 'cafe',
  name: 'Butik Kafe',
  description: 'Kahve dükkanları ve butik kafeler için sıcak, samimi template',
  category: 'cafe',
  thumbnail: '☕',
  tags: ['kafe', 'kahve', 'pastane'],
  theme: {
    primaryColor: '#92400e', // Kahverengi
    secondaryColor: '#451a03',
    fontFamily: 'Georgia, serif',
    borderRadius: '6px',
  },
  blocks: [
    {
      type: 'Hero',
      props: {
        title: 'Kahvenin Sanatı',
        subtitle: 'Özenle seçilmiş çekirdekler, ustaca hazırlanmış her fincan',
        btnText: 'Menüyü Gör',
      },
    },
    {
      type: 'AnnouncementBar',
      props: {
        text: '☕ Her gün 09:00-11:00 arası kahvaltıda %20 indirim!',
        bgColor: '#fef3c7',
        textColor: '#92400e',
        link: '',
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'İmza Kahvelerimiz',
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
      props: { height: '30px' },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Mekanımız',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'GalleryBlock',
      props: {
        columns: 3,
        gap: 12,
        images: [
          'https://picsum.photos/seed/c1/500/500',
          'https://picsum.photos/seed/c2/500/500',
          'https://picsum.photos/seed/c3/500/500',
          'https://picsum.photos/seed/c4/500/500',
          'https://picsum.photos/seed/c5/500/500',
          'https://picsum.photos/seed/c6/500/500',
        ],
      },
    },
    {
      type: 'StatsBlock',
      props: {
        items: [
          { value: '15+', label: 'Çekirdek Çeşidi' },
          { value: '50K+', label: 'Fincan Kahve' },
          { value: '4.9', label: 'Müşteri Puanı' },
          { value: '7', label: 'Yıllık Tecrübe' },
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Misafirlerimizin Yorumları',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'TestimonialsBlock',
      props: {
        items: [
          {
            name: 'Deniz K.',
            role: 'Kahve Tutkunu',
            text: 'Şehrin en iyi espresso\'su burada. Atmosfer harika!',
            avatar: 'https://picsum.photos/seed/cu1/100',
          },
          {
            name: 'Burak T.',
            role: 'Freelancer',
            text: 'Çalışmak için mükemmel bir ortam. WiFi hızlı, kahve sonsuz.',
            avatar: 'https://picsum.photos/seed/cu2/100',
          },
          {
            name: 'Elif S.',
            role: 'Düzenli Müşteri',
            text: 'Ev yapımı tatlıları denemelisiniz. Harika!',
            avatar: 'https://picsum.photos/seed/cu3/100',
          },
        ],
      },
    },
    {
      type: 'MapBlock',
      props: {
        address: 'Moda Caddesi, Kadıköy, İstanbul',
      },
    },
    {
      type: 'QRCodeBlock',
      props: {
        url: 'https://penpos.cloud/menu/cafe',
        label: '📱 QR Kodu okutarak menüye ulaşın',
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