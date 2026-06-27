import React from 'react'
import { AccordionBlock } from './components/AccordionBlock.tsx'
import { AnnouncementBar } from './components/AnnouncementBar.tsx'
import { ButtonBlock } from './components/ButtonBlock.tsx'
import { ContactForm } from './components/ContactForm.jsx'
import { Container } from './components/Container.jsx'
import { DividerBlock } from './components/DividerBlock.tsx'
import { EmbedBlock } from './components/EmbedBlock.tsx'
import { FreeBlock } from './components/FreeBlock.tsx'
import { FreeCanvas } from './components/FreeCanvas.tsx'
import { GalleryBlock } from './components/GalleryBlock.tsx'
import { HeadingBlock } from './components/HeadingBlock.tsx'
import { Hero } from './components/Hero.jsx'
import { ImageBlock } from './components/ImageBlock.tsx'
import { ListBlock } from './components/ListBlock.tsx'
import { MapBlock } from './components/MapBlock.jsx'
import { PricingBlock } from './components/PricingBlock.tsx'
import { ProductGrid } from './components/ProductGrid.jsx'
import { QRCodeBlock } from './components/QRCodeBlock.jsx'
import { RestaurantMenu } from './components/RestaurantMenu.jsx'
import { SocialBlock } from './components/SocialBlock.tsx'
import { SpacerBlock } from './components/SpacerBlock.tsx'
import { StatsBlock } from './components/StatsBlock.tsx'
import { TabsBlock } from './components/TabsBlock.tsx'
import { TestimonialsBlock } from './components/TestimonialsBlock.tsx'
import { TextBlock } from './components/TextBlock.tsx'
import { VideoBlock } from './components/VideoBlock.tsx'
import { Column, Row, Section } from './components/layout/index.ts'

export const editorResolver = {
  Container,
  FreeBlock,
  FreeCanvas,
  Section,
  Row,
  Column,
  Hero,
  ProductGrid,
  RestaurantMenu,
  QRCodeBlock,
  MapBlock,
  ContactForm,
  HeadingBlock,
  TextBlock,
  ButtonBlock,
  ListBlock,
  SpacerBlock,
  DividerBlock,
  ImageBlock,
  GalleryBlock,
  VideoBlock,
  AccordionBlock,
  TabsBlock,
  AnnouncementBar,
  PricingBlock,
  TestimonialsBlock,
  StatsBlock,
  SocialBlock,
  EmbedBlock,
}

export const editorBlockGroups = [
  {
    category: 'SERBEST',
    items: [
      { name: 'Serbest Kanvas', component: FreeCanvas, icon: 'FREE' },
      { name: 'Serbest Blok', component: FreeBlock, icon: 'MOVE' },
    ],
  },
  {
    category: 'YAPI',
    items: [
      {
        name: 'Bolum',
        component: Section,
        icon: 'SEC',
        create: () =>
          React.createElement(
            Section,
            { padding: '60px 20px', background: '#ffffff' },
            React.createElement(
              Row,
              { gap: '20px' },
              React.createElement(Column, { width: '100%', padding: '0px' })
            )
          ),
      },
      { name: 'Satir', component: Row, icon: 'ROW' },
      { name: 'Sutun', component: Column, icon: 'COL' },
    ],
  },
  {
    category: 'TEMEL',
    items: [
      { name: 'Baslik', component: HeadingBlock, icon: 'H' },
      { name: 'Metin Kutusu', component: TextBlock, icon: 'T' },
      { name: 'Buton', component: ButtonBlock, icon: '[]' },
      { name: 'Liste', component: ListBlock, icon: '::' },
      { name: 'Bosluk', component: SpacerBlock, icon: '<>' },
      { name: 'Ayirici Cizgi', component: DividerBlock, icon: '--' },
    ],
  },
  {
    category: 'MEDYA',
    items: [
      { name: 'Resim', component: ImageBlock, icon: 'IMG' },
      { name: 'Resim Galerisi', component: GalleryBlock, icon: 'GAL' },
      { name: 'Video', component: VideoBlock, icon: 'VID' },
    ],
  },
  {
    category: 'ETKILESIM',
    items: [
      { name: 'Akordeon', component: AccordionBlock, icon: 'ACC' },
      { name: 'Sekmeler', component: TabsBlock, icon: 'TAB' },
      { name: 'Duyuru Cubugu', component: AnnouncementBar, icon: 'ANN' },
    ],
  },
  {
    category: 'IS',
    items: [
      { name: 'Fiyat Tablosu', component: PricingBlock, icon: 'TRY' },
      { name: 'Musteri Yorumlari', component: TestimonialsBlock, icon: '***' },
      { name: 'Istatistikler', component: StatsBlock, icon: '123' },
      { name: 'Sosyal Medya', component: SocialBlock, icon: 'SOC' },
    ],
  },
  {
    category: 'OZEL',
    items: [
      { name: 'Hero Banner', component: Hero, icon: 'HERO' },
      { name: 'HTML Gomme', component: EmbedBlock, icon: '</>' },
    ],
  },
  {
    category: 'PENPOS',
    items: [
      { name: 'Urun Izgarasi', component: ProductGrid, icon: 'PRD' },
      { name: 'Restoran Menusu', component: RestaurantMenu, icon: 'MEN' },
      { name: 'QR Kod', component: QRCodeBlock, icon: 'QR' },
      { name: 'Harita', component: MapBlock, icon: 'MAP' },
      { name: 'Iletisim Formu', component: ContactForm, icon: 'CNT' },
    ],
  },
]
