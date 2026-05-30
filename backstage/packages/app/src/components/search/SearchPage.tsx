import React from 'react';
import { Grid } from '@material-ui/core';
import { CatalogSearchResultListItem } from '@backstage/plugin-catalog';
import {
  SearchResult,
} from '@backstage/plugin-search-react';
import { CatalogIcon, DocsIcon } from '@backstage/core-components';
import { TechDocsSearchResultListItem } from '@backstage/plugin-techdocs';

export const searchPage = (
  <Grid container direction="row">
    <Grid item xs={12}>
      <SearchResult>
        <CatalogSearchResultListItem icon={<CatalogIcon />} />
        <TechDocsSearchResultListItem icon={<DocsIcon />} />
      </SearchResult>
    </Grid>
  </Grid>
);
