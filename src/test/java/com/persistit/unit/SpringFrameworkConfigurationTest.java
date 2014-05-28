/**
 * Copyright 2011-2012 Akiban Technologies, Inc.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.persistit.unit;

import com.persistit.Persistit;
import com.persistit.exception.PersistitException;
import org.junit.After;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.springframework.context.ApplicationContext;
import org.springframework.context.support.ClassPathXmlApplicationContext;

import static org.junit.Assert.assertTrue;

/**
 * Create a Persistit instance using Spring Framework.
 * 
 * @author peter
 * 
 */
public class SpringFrameworkConfigurationTest {

  @Rule
  public TemporaryFolder temp = new TemporaryFolder();

  public static class TestClient {
    final Persistit db;

    public TestClient(final Persistit db) {
      this.db = db;
    }

    private void test() {
      System.out.println(db.getVolumes());
      try {
        db.close();
      } catch (final PersistitException e) {
        e.printStackTrace();
      }
    }
  }

  @Test
  public void configurePersistitFromSpring() throws Exception {
    System.setProperty("com.persistit.datapath", temp.newFolder().getAbsolutePath().replaceAll("\\\\", "/"));
    final ApplicationContext context = new ClassPathXmlApplicationContext(
      "com/persistit/unit/SpringFrameworkConfiguraitonTest.xml");

    final Persistit persistit = (Persistit) context.getBean("persistit");
    assertTrue("Persistit should be initialized", persistit.isInitialized());

    final TestClient testClient = (TestClient) context.getBean("testClient");
    testClient.test();
  }

  @After
  public void cleanup() {
    System.clearProperty("com.persistit.datapath");
  }

}
