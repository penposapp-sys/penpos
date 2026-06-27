import { ReactNode } from 'react';

export interface TemplateBlock {
  type: string; // Component resolvedName
  props: Record<string, any>;
  children?: TemplateBlock[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: 'restaurant' | 'store' | 'portfolio' | 'cafe' | 'services' | 'landing';
  thumbnail: string; // emoji veya URL
  tags: string[];
  blocks: TemplateBlock[];
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    borderRadius?: string;
  };
}

export interface TemplateCategory {
  id: string;
  name: string;
  icon: string;
  templates: Template[];
}
