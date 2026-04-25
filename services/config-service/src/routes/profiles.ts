import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import { query } from '../utils/database';
import { authenticate } from '../middleware/auth';

const PROXY_DOMAIN = process.env.PROXY_DOMAIN || 'devflowlabs.io';

function generateMobileConfig(
  projectName: string,
  proxySubdomain: string,
  proxyDomain: string
): string {
  const proxyUrl = `${proxySubdomain}.${proxyDomain}`;
  const pacScript = `
function FindProxyForURL(url, host) {
  return "PROXY ${proxyUrl}:8080; DIRECT";
}`.trim();

  const pacBase64 = Buffer.from(pacScript).toString('base64');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key>
      <string>com.apple.webcontent-filter</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadIdentifier</key>
      <string>io.devflowlabs.proxy.${proxySubdomain}</string>
      <key>PayloadUUID</key>
      <string>${crypto.randomUUID()}</string>
      <key>PayloadDisplayName</key>
      <string>DevFlow Labs Proxy - ${projectName}</string>
      <key>PayloadDescription</key>
      <string>Routes traffic through DevFlow Labs proxy for API testing</string>
      <key>FilterType</key>
      <string>Plugin</string>
      <key>AutoFilterEnabled</key>
      <false/>
    </dict>
    <dict>
      <key>PayloadType</key>
      <string>com.apple.proxy.http.global</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadIdentifier</key>
      <string>io.devflowlabs.pac.${proxySubdomain}</string>
      <key>PayloadUUID</key>
      <string>${crypto.randomUUID()}</string>
      <key>PayloadDisplayName</key>
      <string>DevFlow Labs PAC - ${projectName}</string>
      <key>ProxyPACURL</key>
      <string>https://${proxyUrl}/proxy.pac</string>
      <key>ProxyPACFallbackAllowed</key>
      <true/>
    </dict>
  </array>
  <key>PayloadDisplayName</key>
  <string>DevFlow Labs - ${projectName}</string>
  <key>PayloadIdentifier</key>
  <string>io.devflowlabs.profile.${proxySubdomain}</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${crypto.randomUUID()}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
  <key>PayloadDescription</key>
  <string>DevFlow Labs configuration profile for API interception and A/B testing</string>
</dict>
</plist>`;
}

export const profileRoutes: FastifyPluginCallback = (
  fastify: FastifyInstance,
  _opts,
  done
) => {
  fastify.addHook('preHandler', authenticate);

  // Generate iOS .mobileconfig profile
  fastify.get<{ Params: { projectId: string } }>(
    '/ios/:projectId',
    async (request, reply) => {
      const result = await query(
        'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
        [request.params.projectId, request.userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Project not found',
          statusCode: 404,
        });
      }

      const project = result.rows[0];
      const mobileConfig = generateMobileConfig(
        project.name,
        project.proxy_subdomain,
        PROXY_DOMAIN
      );

      reply
        .header('Content-Type', 'application/x-apple-aspen-config')
        .header(
          'Content-Disposition',
          `attachment; filename="devflow-${project.slug}.mobileconfig"`
        )
        .send(mobileConfig);
    }
  );

  // Get proxy info for a project
  fastify.get<{ Params: { projectId: string } }>(
    '/proxy-info/:projectId',
    async (request, reply) => {
      const result = await query(
        'SELECT proxy_subdomain, name, slug FROM projects WHERE id = $1 AND user_id = $2',
        [request.params.projectId, request.userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Project not found',
          statusCode: 404,
        });
      }

      const project = result.rows[0];
      return reply.send({
        proxyUrl: `${project.proxy_subdomain}.${PROXY_DOMAIN}`,
        subdomain: project.proxy_subdomain,
        projectName: project.name,
      });
    }
  );

  done();
};
