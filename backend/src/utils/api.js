export function toClientDoc(doc) {
  if (doc == null) return doc;
  const o = doc.toObject ? doc.toObject() : { ...doc };
  delete o._id;
  delete o.__v;
  return o;
}

export function toClientList(docs) {
  return docs.map(toClientDoc);
}

export function toClientUser(doc) {
  if (doc == null) return doc;
  const o = toClientDoc(doc);
  if (o) delete o.passwordHash;
  return o;
}
