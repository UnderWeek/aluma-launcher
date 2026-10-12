const compatibleVersion = (version, { mc, loader, kind }) =>
  (!mc || (version.game_versions || []).includes(mc)) &&
  (kind !== 'mods' || !loader || loader === 'vanilla' || (version.loaders || []).includes(loader)) &&
  !['server_only', 'dedicated_server_only'].includes(version.environment) &&
  !!version.files?.length

const versionQuery = ({ mc, loader, kind }) => {
  const query = new URLSearchParams({ include_changelog: 'false' })
  if (mc) query.set('game_versions', JSON.stringify([mc]))
  if (kind === 'mods' && loader && loader !== 'vanilla') query.set('loaders', JSON.stringify([loader]))
  return query
}

module.exports = { compatibleVersion, versionQuery }
