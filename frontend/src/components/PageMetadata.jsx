import { useLayoutEffect } from 'react';
import { pageDescription } from '../utils/metadata.js';

const owners = [];
let original;

function write(title, description, canonical) {
  const titles = [...document.head.querySelectorAll('title')];
  const descriptions = [...document.head.querySelectorAll('meta[name="description"]')];
  const titleNode = titles.shift() || document.head.appendChild(document.createElement('title'));
  const descriptionNode = descriptions.shift() || document.head.appendChild(document.createElement('meta'));
  titles.forEach(node => node.remove());
  descriptions.forEach(node => node.remove());
  titleNode.textContent = title;
  descriptionNode.name = 'description';
  descriptionNode.content = description;
  const links = [...document.head.querySelectorAll('link[rel~="canonical" i]')];
  if (canonical) {
    const link = links.shift() || document.head.appendChild(document.createElement('link'));
    link.rel = 'canonical';
    link.href = canonical;
  }
  links.forEach(node => node.remove());
}

function topOwner(candidates) {
  return candidates.reduce((chosen, owner) => !chosen || owner.priority >= chosen.priority ? owner : chosen, null);
}

function reconcile() {
  const active = topOwner(owners);
  if (active) {
    // صفحه می‌تواند مقدار مسیر را به ارث ببرد؛ null صریح، آن را در خطا/حالت خصوصی پاک می‌کند.
    const inherited = topOwner(owners.filter(owner => owner.priority < active.priority && owner.canonical !== undefined));
    const canonical = active.canonical === undefined ? inherited?.canonical : active.canonical;
    write(active.title, active.description, canonical);
  }
  else if (original) {
    write(original.title, original.description, original.canonical);
    original = null;
  }
}

export default function PageMetadata({ title, description = pageDescription(title), priority = 1, canonical }) {
  useLayoutEffect(() => {
    if (!owners.length) original = {
      title: document.head.querySelector('title')?.textContent || '',
      description: document.head.querySelector('meta[name="description"]')?.content || '',
      canonical: document.head.querySelector('link[rel~="canonical" i]')?.getAttribute('href') || null,
    };
    const owner = { title, description, priority, canonical };
    owners.push(owner);
    reconcile();
    return () => {
      owners.splice(owners.indexOf(owner), 1);
      reconcile();
    };
  }, [title, description, priority, canonical]);
  return null;
}
