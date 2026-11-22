-- Collapse overlapping permissive policies without broadening row access.

DROP POLICY IF EXISTS announcements_admin_manage ON public.announcements;
CREATE POLICY announcements_admin_insert ON public.announcements
  FOR INSERT TO public WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY announcements_admin_update ON public.announcements
  FOR UPDATE TO public USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY announcements_admin_delete ON public.announcements
  FOR DELETE TO public USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS business_gallery_owner_all ON public.business_gallery_images;
DROP POLICY IF EXISTS business_gallery_public_read ON public.business_gallery_images;
CREATE POLICY business_gallery_read ON public.business_gallery_images
  FOR SELECT TO anon, authenticated
  USING (
    (owner_id = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_gallery_images.business_id AND b.owner_id = (SELECT auth.uid())
    ))
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_gallery_images.business_id AND b.is_published IS TRUE
    )
  );
CREATE POLICY business_gallery_insert ON public.business_gallery_images
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = business_gallery_images.business_id AND b.owner_id = (SELECT auth.uid())
  ));
CREATE POLICY business_gallery_update ON public.business_gallery_images
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = business_gallery_images.business_id AND b.owner_id = (SELECT auth.uid())
  ))
  WITH CHECK (owner_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = business_gallery_images.business_id AND b.owner_id = (SELECT auth.uid())
  ));
CREATE POLICY business_gallery_delete ON public.business_gallery_images
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = business_gallery_images.business_id AND b.owner_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS businesses_admin_read ON public.businesses;
DROP POLICY IF EXISTS businesses_owner_read ON public.businesses;
DROP POLICY IF EXISTS businesses_public_read ON public.businesses;
CREATE POLICY businesses_read ON public.businesses
  FOR SELECT TO anon, authenticated
  USING (
    (SELECT public.is_admin())
    OR owner_id = (SELECT auth.uid())
    OR (
      is_published AND (
        (SELECT auth.uid()) IS NULL
        OR COALESCE(
          (SELECT p.account_type FROM public.profiles p WHERE p.id = (SELECT auth.uid())),
          'business'::public.account_role
        ) <> 'investor'::public.account_role
        OR COALESCE(((SELECT public.current_plan_features()) ->> 'monthly_business_views')::integer, 0) = -1
        OR EXISTS (
          SELECT 1 FROM public.profile_views v
          WHERE v.viewer_id = (SELECT auth.uid()) AND v.business_id = businesses.id
        )
        OR (
          SELECT count(*) FROM public.profile_views v
          WHERE v.viewer_id = (SELECT auth.uid())
            AND v.business_id IS NOT NULL
            AND v.created_at >= date_trunc('month', now())
        ) < COALESCE(((SELECT public.current_plan_features()) ->> 'monthly_business_views')::integer, 0)
      )
    )
  );

DROP POLICY IF EXISTS connections_recipient_decision ON public.connections;
DROP POLICY IF EXISTS connections_requester_cancel ON public.connections;
CREATE POLICY connections_participant_update ON public.connections
  FOR UPDATE TO public
  USING (
    (
      (recipient_id = (SELECT auth.uid()) AND status = 'pending'::public.connection_status)
      OR (requester_id = (SELECT auth.uid()) AND status = 'pending'::public.connection_status)
    )
    AND (SELECT public.is_active_member())
  )
  WITH CHECK (
    (
      (recipient_id = (SELECT auth.uid()) AND status = ANY(ARRAY['accepted','rejected']::public.connection_status[]))
      OR (requester_id = (SELECT auth.uid()) AND status = 'cancelled'::public.connection_status)
    )
    AND (SELECT public.is_active_member())
  );

DROP POLICY IF EXISTS investors_owner_write ON public.investors;
CREATE POLICY investors_owner_insert ON public.investors
  FOR INSERT TO public
  WITH CHECK (((id = (SELECT auth.uid())) AND (SELECT public.is_active_member())) OR (SELECT public.is_admin()));
CREATE POLICY investors_owner_update ON public.investors
  FOR UPDATE TO public
  USING (((id = (SELECT auth.uid())) AND (SELECT public.is_active_member())) OR (SELECT public.is_admin()))
  WITH CHECK (((id = (SELECT auth.uid())) AND (SELECT public.is_active_member())) OR (SELECT public.is_admin()));
CREATE POLICY investors_owner_delete ON public.investors
  FOR DELETE TO public
  USING (((id = (SELECT auth.uid())) AND (SELECT public.is_active_member())) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS subscription_plans_admin_read ON public.subscription_plans;
DROP POLICY IF EXISTS subscription_plans_read ON public.subscription_plans;
CREATE POLICY subscription_plans_read ON public.subscription_plans
  FOR SELECT TO anon, authenticated
  USING (is_active OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS subscriptions_admin_manage ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_activate_free ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_switch_to_free ON public.subscriptions;
CREATE POLICY subscriptions_insert_access ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR (
      user_id = (SELECT auth.uid()) AND status = 'active'
      AND EXISTS (
        SELECT 1 FROM public.subscription_plans p
        JOIN public.profiles u ON u.id = (SELECT auth.uid())
        WHERE p.id = subscriptions.plan_id AND p.price_inr = 0
          AND p.account_type = u.account_type AND p.is_active
      )
    )
  );
CREATE POLICY subscriptions_update_access ON public.subscriptions
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()) OR user_id = (SELECT auth.uid()))
  WITH CHECK (
    (SELECT public.is_admin())
    OR (
      user_id = (SELECT auth.uid()) AND status = 'active'
      AND EXISTS (
        SELECT 1 FROM public.subscription_plans p
        JOIN public.profiles u ON u.id = (SELECT auth.uid())
        WHERE p.id = subscriptions.plan_id AND p.price_inr = 0
          AND p.account_type = u.account_type AND p.is_active
      )
    )
  );
CREATE POLICY subscriptions_admin_delete ON public.subscriptions
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));
