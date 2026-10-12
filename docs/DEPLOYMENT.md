# Website deployment

GitHub Pages publishes the `docs/` directory on the `main` branch.

In the DNS zone for `lostcat.online`, add:

| Type | Name / Host | Target / Value | TTL |
| --- | --- | --- | --- |
| CNAME | aluma | underweek.github.io | Auto / default |

The target has no `https://`, repository name, or path. Some DNS dashboards
require the full name `aluma.lostcat.online` instead of just `aluma`.
If this hostname already has an A, AAAA, or CNAME record, replace that record
instead of adding a conflicting one. Leave the domain's other records alone.

After DNS resolves, GitHub can issue the HTTPS certificate. In repository
Settings → Pages, enable Enforce HTTPS when the certificate is ready.

The temporary GitHub URL before setting the custom domain is
`https://underweek.github.io/aluma-launcher/`. Once the custom domain is set,
GitHub redirects that URL to `aluma.lostcat.online`.
