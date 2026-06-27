import { Template } from '../TemplateTypes';

export const portfolioTemplate: Template = {
  id: 'portfolio',
  name: 'Yaratıcı Portfolio',
  description: 'Freelancer, tasarımcı ve sanatçılar için minimal portfolio',
  category: 'portfolio',
  thumbnail: '🎨',
  tags: ['portfolio', 'kişisel', 'tasarım'],
  theme: {
    primaryColor: '#7c3aed', // Mor
    secondaryColor: '#1f2937',
    fontFamily: 'system-ui, sans-serif',
    borderRadius: '12px',
  },
  blocks: [
    {
      type: 'Hero',
      props: {
        title: 'Merhaba, Ben Ayşe',
        subtitle: 'UI/UX Designer & Frontend Developer. Minimal ve fonksiyonel tasarımlar üretiyorum.',
        btnText: 'Projelerimi Gör',
      },
    },
    {
      type: 'StatsBlock',
      props: {
        items: [
          { value: '8+', label: 'Yıl Deneyim' },
          { value: '150+', label: 'Tamamlanan Proje' },
          { value: '50+', label: 'Mutlu Müşteri' },
          { value: '12', label: 'Ödül' },
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Seçkin Projeler',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'GalleryBlock',
      props: {
        columns: 3,
        gap: 16,
        images: [
          'https://picsum.photos/seed/p1/600/400',
          'https://picsum.photos/seed/p2/600/400',
          'https://picsum.photos/seed/p3/600/400',
          'https://picsum.photos/seed/p4/600/400',
          'https://picsum.photos/seed/p5/600/400',
          'https://picsum.photos/seed/p6/600/400',
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Hizmetlerim',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'TabsBlock',
      props: {
        tabs: [
          {
            title: '🎨 UI/UX Design',
            content: 'Kullanıcı odaklı, modern ve erişilebilir arayüz tasarımları. Figma, Adobe XD.',
          },
          {
            title: '💻 Frontend Development',
            content: 'React, Next.js, TypeScript ile performanslı web uygulamaları.',
          },
          {
            title: '📱 Mobile Design',
            content: 'iOS ve Android için native tasarım sistemleri. Flutter entegrasyonu.',
          },
          {
            title: '🎯 Branding',
            content: 'Logo, kurumsal kimlik ve marka stratejisi geliştirme.',
          },
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Sıkça Sorulan Sorular',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'AccordionBlock',
      props: {
        items: [
          {
            q: 'Bir proje ne kadar sürer?',
            a: 'Proje kapsamına göre değişir. Basit bir landing page 1-2 hafta, kapsamlı bir uygulama 2-3 ay sürebilir.',
          },
          {
            q: 'Hangi araçları kullanıyorsunuz?',
            a: 'Tasarım için Figma, geliştirme için React/Next.js, TypeScript, Tailwind CSS kullanıyorum.',
          },
          {
            q: 'Uzaktan çalışıyor musunuz?',
            a: 'Evet, dünyanın her yerinden müşterilerle uzaktan çalışıyorum. İletişim için Slack, Zoom kullanıyorum.',
          },
          {
            q: 'Ödeme koşullarınız nasıl?',
            a: '%50 ön ödeme, %50 proje tesliminde. Büyük projelerde aylık taksitlendirme yapıyorum.',
          },
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Birlikte Çalışalım',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'ContactForm',
      props: {
        title: 'Proje Teklifi Alın',
        btnText: 'İletişime Geç',
      },
    },
    {
      type: 'SocialBlock',
      props: {
        size: 36,
        links: [
          { platform: 'linkedin', url: 'https://linkedin.com' },
          { platform: 'instagram', url: 'https://instagram.com' },
          { platform: 'twitter', url: 'https://twitter.com' },
          { platform: 'youtube', url: 'https://youtube.com' },
        ],
      },
    },
  ],
};