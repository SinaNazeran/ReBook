import { useLayoutEffect } from 'react';
import { pageDescription } from '../utils/metadata.js';

const owners = [];
let original;

function write(title, description) {
  const titles = [...document.head.querySelectorAll('title')];
  const descriptions = [...document.head.querySelectorAll('meta[name="description"]')];
  const titleNode = titles.shift() || document.head.appendChild(document.createElement('title'));
  const descriptionNode = descriptions.shift() || document.head.appendChild(document.createElement('meta'));
  titles.forEach(node => node.remove());
  descriptions.forEach(node => node.remove());
  titleNode.textContent = title;
  descriptionNode.name = 'description';
  descriptionNode.content = description;
}

function reconcile() {
  const active = owners.reduce((chosen, owner) => !chosen || owner.priority >= chosen.priority ? owner : chosen, null);
  if (active) write(active.title, active.description);
  else if (original) {
    write(original.title, original.description);
    original = null;
  }
}

export default function PageMetadata({ title, description = pageDescription(title), priority = 1 }) {
  useLayoutEffect(() => {
    if (!owners.length) original = {
      title: document.head.querySelector('title')?.textContent || '',
      description: document.head.querySelector('meta[name="description"]')?.content || '',
    };
    const owner = { title, description, priority };
    owners.push(owner);
    reconcile();
    return () => {
      owners.splice(owners.indexOf(owner), 1);
      reconcile();
    };
  }, [title, description, priority]);
  return null;
}
