import { MatPaginatorIntl } from '@angular/material/paginator';

export function frenchPaginator(): MatPaginatorIntl {
  const labels = new MatPaginatorIntl();
  labels.itemsPerPageLabel = 'Lignes par page :';
  labels.nextPageLabel = 'Page suivante';
  labels.previousPageLabel = 'Page précédente';
  labels.firstPageLabel = 'Première page';
  labels.lastPageLabel = 'Dernière page';
  labels.getRangeLabel = (page, size, total) =>
    total === 0
      ? '0 résultat'
      : `${page * size + 1}–${Math.min((page + 1) * size, total)} sur ${total}`;
  return labels;
}
